import { createFileRoute } from "@tanstack/react-router";
import { geminiJSON } from "~/agent/tools/gemini";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { upsertDraft } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import { getTemplate } from "~/db/queries/templates";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { Lead } from "~/types/lead";
import type { Template } from "~/db/queries/templates";


function resolveTokens(text: string, lead: Lead): string {
  const parts = (lead.ceo ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return text
    .replaceAll("{{firstName}}", firstName)
    .replaceAll("{{lastName}}", lastName)
    .replaceAll("{{fullName}}", lead.ceo ?? "")
    .replaceAll("{{company}}", lead.company ?? "")
    .replaceAll("{{website}}", lead.website ?? "")
    .replaceAll("{{whatTheyDo}}", lead.whatTheyDo ?? "");
}

async function generateWithAI(opts: {
  channel: string;
  lead: Lead;
  productContext: string;
  campaignGoal: string | null | undefined;
  stepContext: string | null | undefined;
  isFollowUp: boolean;
}): Promise<{ subject: string | null; body: string }> {
  const { channel, lead, productContext, campaignGoal, stepContext, isFollowUp } = opts;

  const leadContext = [
    `Company: ${lead.company}`,
    `CEO/Contact: ${lead.ceo}`,
    lead.whatTheyDo ? `What they do: ${lead.whatTheyDo}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    lead.fit ? `ICP fit: ${lead.fit}` : null,
    lead.fitReason ? `Why they're a fit: ${lead.fitReason}` : null,
    lead.score != null ? `Fit score: ${lead.score}/100` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ].filter(Boolean).join("\n");

  const stepHint = stepContext ? `\n\nSTEP CONTEXT\n${stepContext}` : "";

  const isEmail = channel === "email";
  const systemPrompt = `You are a concise, direct outreach writer. Write a highly personalised cold ${isEmail ? "email" : "LinkedIn DM"} that doesn't sound like a template.${isFollowUp ? " This is a follow-up — acknowledge you've reached out before, keep it shorter and more casual." : ""}

Rules:
- Never start with filler openers
- Reference what their company actually does and why the product is genuinely relevant
- Maximum 4 sentences.${isEmail ? " Subject line under 8 words." : ""}
- End with one clear, low-friction CTA
- Write as a human, not a marketer

Return JSON: { "subject": ${isEmail ? '"short subject line"' : "null"}, "body": "message body" }`;

  const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaignGoal ? `\n\nCAMPAIGN GOAL\n${campaignGoal}` : ""}${stepHint}`;

  console.log("[generate-drafts] systemPrompt:", systemPrompt);
  console.log("[generate-drafts] userPrompt:", userPrompt);
  const parsed = await geminiJSON<{ subject?: string | null; body?: string }>(userPrompt, {
    maxTokens: 1024,
    system: systemPrompt,
  });
  if (!parsed.body) throw new Error("No body in response");

  return { subject: parsed.subject ?? null, body: parsed.body };
}

export const Route = createFileRoute("/api/campaigns/$id/generate-drafts")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { id } = params;

        let filterLeadId: string | null = null;
        let filterStepNumber: number | null = null;
        try {
          const body = await request.json() as { leadId?: string; stepNumber?: number };
          filterLeadId = body.leadId ?? null;
          filterStepNumber = body.stepNumber ?? null;
        } catch { /* no body = generate all */ }

        const campaign = await getCampaign(id);
        if (!campaign) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const allLeads = await getCampaignLeadsWithData(id);
        if (allLeads.length === 0) {
          return new Response(JSON.stringify({ error: "no_leads" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const leads = filterLeadId ? allLeads.filter((l) => l.id === filterLeadId) : allLeads;
        const steps = await listSteps(id);
        const stepsToRun = filterStepNumber != null
          ? steps.filter((s) => s.stepNumber === filterStepNumber)
          : steps.length > 0 ? steps : [{ stepNumber: 1, channel: campaign.channel ?? "email", context: null, delayDays: 0, templateId: null }];

        // Load org profile from metadata
        let orgProfile: Record<string, string> = {};
        try {
          const headers = getRequestHeaders();
          const orgs = await auth.api.listOrganizations({ headers });
          const org = orgs?.find((o) => o.id === campaign.organizationId);
          if (org?.metadata) {
            orgProfile = JSON.parse(org.metadata as string) as Record<string, string>;
          }
        } catch { /* use empty profile */ }

        const productContext = [
          orgProfile.description ? `Product: ${orgProfile.description}` : null,
          orgProfile.website ? `Website: ${orgProfile.website}` : null,
          orgProfile.industry ? `Industry: ${orgProfile.industry}` : null,
          orgProfile.useCases ? `Use cases: ${orgProfile.useCases}` : null,
        ].filter(Boolean).join("\n");

        const generated: { leadId: string; stepNumber: number; ok: boolean }[] = [];

        for (const step of stepsToRun) {
          const channel = step.channel === "linkedin" ? "linkedin" : "email";
          const isFollowUp = step.stepNumber > 1;

          // Load template if this step has one
          let template: Template | null = null;
          if ("templateId" in step && step.templateId) {
            template = await getTemplate(step.templateId).catch(() => null);
          }

          const hasVariantB = !!(template?.variantBBody);

          for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            // Assign variant: even-indexed → 'a', odd-indexed → 'b' (only when template has variant B)
            const abVariant: "a" | "b" = (hasVariantB && i % 2 === 1) ? "b" : "a";

            try {
              let subject: string | null;
              let body: string;

              if (template) {
                // Template-based: resolve tokens, no AI generation
                const useB = abVariant === "b" && hasVariantB;
                const rawSubject = useB ? (template.variantBSubject ?? template.subject) : template.subject;
                const rawBody = useB ? (template.variantBBody ?? template.body) : template.body;
                subject = rawSubject ? resolveTokens(rawSubject, lead as Lead) : null;
                body = resolveTokens(rawBody, lead as Lead);
              } else {
                // AI generation
                const result = await generateWithAI({
                  channel,
                  lead: lead as Lead,
                  productContext,
                  campaignGoal: campaign.goal,
                  stepContext: "context" in step ? step.context as string | null : null,
                  isFollowUp,
                });
                subject = result.subject;
                body = result.body;
              }

              await upsertDraft({
                campaignId: id,
                leadId: lead.id,
                channel,
                subject,
                body,
                stepNumber: step.stepNumber,
                abVariant,
              });

              generated.push({ leadId: lead.id, stepNumber: step.stepNumber, ok: true });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.error(`[generate-drafts] Failed for lead ${lead.id} step ${step.stepNumber}: ${message}`);
              generated.push({ leadId: lead.id, stepNumber: step.stepNumber, ok: false });
            }
          }
        }

        const succeeded = generated.filter((g) => g.ok).length;
        return Response.json({ ok: true, generated: succeeded, total: generated.length });
      },
    },
  },
});
