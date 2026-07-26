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
import type { CampaignIntent } from "~/types/campaign";
import { notifyDraftsReady } from "~/lib/slack-notifications";


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

function buildSystemPrompt(opts: {
  channel: string;
  isFollowUp: boolean;
  intentType: CampaignIntent | null;
}): string {
  const { channel, isFollowUp, intentType } = opts;

  if (channel === "linkedin_connect") {
    return `You are writing a LinkedIn connection request note from a founder to a potential customer.

Rules:
- HARD LIMIT: 300 characters total (LinkedIn enforces this — count carefully)
- One sentence about something specific to THEIR work — show you actually looked them up
- One sentence on why you want to connect — brief, genuine, no pitch
- No CTA beyond connecting — do not ask for a call or a demo
- No filler phrases like "I'd love to connect" or "I came across your profile"
- Sound like a real person, not a template

Return JSON: { "subject": null, "body": "connection note under 300 chars" }`;
  }

  const isEmail = channel === "email";
  const medium = isEmail ? "email" : "LinkedIn DM";
  const subjectRule = isEmail
    ? (isFollowUp ? "\n- Subject line: 5 words max, different from the first" : "\n- Subject line: 6 words max, specific to them — not generic")
    : "";
  const jsonShape = `{ "subject": ${isEmail ? '"short subject"' : "null"}, "body": "message" }`;

  if (isFollowUp) {
    return `You are writing a short, human follow-up ${medium} from a founder to a prospect who didn't reply.

Rules:
- Acknowledge you reached out before — casually, not apologetically
- One new angle or value point; don't repeat yourself${subjectRule}
- Under 50 words. Every word must earn its place.
- CTA: softer than the first — "worth a quick chat?" or "happy to share more if useful"
- Read it aloud. If it sounds like a sales email, rewrite it.

Return JSON: ${jsonShape}`;
  }

  const intent = intentType ?? "advice_seeking";

  if (intent === "advice_seeking") {
    return `You are a founder writing a personal, concise outreach ${medium} to a potential early customer. Your goal is not to pitch — it's to get their advice or perspective.

Rules:
- Open with something specific about what THEY do — show you actually looked them up
- Ask for their feedback, opinion, or experience — not a demo, not a sale
- Under 75 words total.${subjectRule}
- One CTA only: low-friction — "would love your take if you have 10 minutes" or "any chance you'd be open to a quick call?"
- Sound like a curious founder, not a sales rep

Return JSON: ${jsonShape}`;
  }

  if (intent === "product_review") {
    return `You are a founder writing a personal outreach ${medium} asking someone to try your product and give honest feedback.

Rules:
- Start with something specific about what THEY do — show genuine interest in their work
- Make the offer clear: try it free, give feedback — no commitment required
- Under 75 words total.${subjectRule}
- One CTA only: "would you be up for trying it and telling me what you think?" or similar
- This is a request for help, not a sales pitch — keep that energy

Return JSON: ${jsonShape}`;
  }

  if (intent === "audit_offer") {
    return `You are a founder writing a personal outreach ${medium} leading with a free, specific audit or analysis as an upfront gift.

Rules:
- Open by naming something concrete about their business you noticed — make the audit feel relevant to THEM
- Offer the audit for free, no strings — make the value obvious in one sentence
- Under 75 words total.${subjectRule}
- One CTA only: low-friction — "want me to run this for you?" or "happy to send it over if useful"
- Never mention a demo or a pitch; the audit IS the intro

Return JSON: ${jsonShape}`;
  }

  // direct_pitch
  return `You are a founder writing a direct, concise outreach ${medium} with a clear value prop and a demo ask.

Rules:
- Open with something specific about their business — show you looked them up
- State the core outcome your product delivers in one sentence — specific, not vague
- Under 75 words total.${subjectRule}
- One CTA only: "would you be open to a 20-min demo?" or "happy to show you how it works"
- Be direct and confident, but not pushy — founders respect founders

Return JSON: ${jsonShape}`;
}

async function generateWithAI(opts: {
  channel: string;
  lead: Lead;
  productContext: string;
  campaignGoal: string | null | undefined;
  stepContext: string | null | undefined;
  isFollowUp: boolean;
  intentType: CampaignIntent | null;
}): Promise<{ subject: string | null; body: string }> {
  const { channel, lead, productContext, campaignGoal, stepContext, isFollowUp, intentType } = opts;

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

  const systemPrompt = buildSystemPrompt({ channel, isFollowUp, intentType });

  const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaignGoal ? `\n\nCAMPAIGN GOAL\n${campaignGoal}` : ""}${stepHint}`;

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
          const channel = (step.channel === "linkedin" || step.channel === "linkedin_connect") ? step.channel : "email";
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
                  intentType: campaign.intentType,
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

        if (succeeded > 0) {
          void notifyDraftsReady({
            orgId: campaign.organizationId,
            campaignName: campaign.name,
            count: succeeded,
          });
        }

        return Response.json({ ok: true, generated: succeeded, total: generated.length });
      },
    },
  },
});
