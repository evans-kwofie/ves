import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { upsertDraft } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const Route = createFileRoute("/api/campaigns/$id/generate-drafts")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { id } = params;

        // Optional filters: generate for a specific lead+step only
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

        let allLeads = await getCampaignLeadsWithData(id);
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
          : steps.length > 0 ? steps : [{ stepNumber: 1, channel: campaign.channel ?? "email", context: null, delayDays: 0 }];

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

          for (const lead of leads) {
            try {
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

              const stepHint = step.context ? `\n\nSTEP CONTEXT\n${step.context}` : "";
              const isFollowUp = step.stepNumber > 1;

              const systemPrompt = `You are a concise, direct outreach writer. Write a highly personalised cold ${channel === "email" ? "email" : "LinkedIn message"} that doesn't sound like a template.${isFollowUp ? " This is a follow-up — acknowledge you've reached out before, keep it shorter and more casual." : ""}

Rules:
- Never start with "I hope this email finds you well" or any filler opener
- Reference what their company actually does and why the product is genuinely relevant
- Maximum 4 sentences. Subject line under 8 words.
- End with one clear, low-friction CTA
- Write as a human, not a marketer

Respond with JSON only: { "subject": "...", "body": "..." }`;

              const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}${stepHint}`;

              const response = await client.messages.create({
                model: "claude-sonnet-4-6",
                max_tokens: 512,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
              });

              const text = response.content.find((b) => b.type === "text")?.text ?? "";
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error("No JSON in response");

              const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
              if (!parsed.body) throw new Error("No body in response");

              await upsertDraft({
                campaignId: id,
                leadId: lead.id,
                channel,
                subject: parsed.subject ?? null,
                body: parsed.body,
                stepNumber: step.stepNumber,
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
