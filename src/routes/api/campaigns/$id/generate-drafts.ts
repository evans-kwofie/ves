import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { upsertDraft } from "~/db/queries/drafts";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const Route = createFileRoute("/api/campaigns/$id/generate-drafts")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { id } = params;

        const campaign = await getCampaign(id);
        if (!campaign) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const leads = await getCampaignLeadsWithData(id);
        if (leads.length === 0) {
          return new Response(JSON.stringify({ error: "no_leads" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

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

        const channel = campaign.channel === "linkedin" ? "linkedin" : "email";
        const generated: { leadId: string; ok: boolean }[] = [];

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

            const systemPrompt = `You are a concise, direct outreach writer. Your job is to write a highly personalised cold ${channel === "email" ? "email" : "LinkedIn message"} that doesn't sound like a template.

Rules:
- Never start with "I hope this email finds you well" or any filler opener
- Do not mention their LinkedIn post, job title, or other superficial signals
- Reference what their company actually does and why the product is genuinely relevant to them
- Maximum 4 sentences. Subject line under 8 words.
- End with one clear, low-friction CTA (e.g. "Open to a quick 20-min call?")
- Write as a human, not a marketer

Respond with JSON only: { "subject": "...", "body": "..." }`;

            const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}`;

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
            });

            generated.push({ leadId: lead.id, ok: true });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[generate-drafts] Failed for lead ${lead.id}: ${message}`);
            generated.push({ leadId: lead.id, ok: false });
          }
        }

        const succeeded = generated.filter((g) => g.ok).length;
        return Response.json({ ok: true, generated: succeeded, total: leads.length });
      },
    },
  },
});
