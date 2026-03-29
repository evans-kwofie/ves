import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { listLeads, updateLead } from "~/db/queries/leads";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().optional(), // single lead, or omit to enrich all discovered
});

const enrichSchema = z.object({
  website: z.string().optional(),
  whatTheyDo: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  fit: z.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z.number().int().min(0).max(100),
  fitReason: z.string(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function enrichAndScore(
  lead: { id: string; company: string; ceo: string; website: string; whatTheyDo: string; email: string },
  orgContext: { name: string; description: string; industry: string; focusAreas: string[] },
): Promise<z.infer<typeof enrichSchema> | null> {
  const prompt = `You are enriching a B2B sales lead and scoring it against an ICP.

Lead:
- Company: ${lead.company}
- Contact: ${lead.ceo}
- Current website: ${lead.website || "unknown"}
- Current description: ${lead.whatTheyDo || "unknown"}
- Current email: ${lead.email || "unknown"}

Selling org context:
- Company: ${orgContext.name}
- What they do: ${orgContext.description || "not provided"}
- Industry: ${orgContext.industry || "not provided"}
- Focus areas: ${orgContext.focusAreas.join(", ") || "not provided"}

Tasks:
1. Search for the company to verify/enrich their website, description, and find a real email for ${lead.ceo}
2. Score this lead against the selling org's ICP

Return ONLY a JSON object with:
- website: verified company website (https://...)
- whatTheyDo: one clear sentence about what the company does
- email: best email guess for the contact (firstname@domain.com format)
- linkedin: LinkedIn profile URL if found, else empty string
- fit: "HIGH", "MEDIUM", or "LOW" — how well this lead matches the ICP
- score: 0-100 integer representing ICP match strength
- fitReason: one sentence explaining the fit score

JSON only, no markdown.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      tools: [{ type: "web_search_20260209" as const, name: "web_search" as const }],
      messages: [{ role: "user", content: prompt }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = enrichSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/pipeline/enrich")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });

        const { organizationId, leadId } = parsed.data;

        // Get org context
        const orgs = await auth.api.listOrganizations({ headers: request.headers });
        const org = orgs?.find((o: { id: string }) => o.id === organizationId) ?? orgs?.[0];
        let metadata: Record<string, string> = {};
        try { metadata = org?.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

        let focusAreas: string[] = [];
        try { focusAreas = metadata.useCases ? JSON.parse(metadata.useCases) : []; } catch {}

        const orgContext = {
          name: org?.name ?? "",
          description: metadata.description ?? "",
          industry: metadata.industry ?? "",
          focusAreas,
        };

        // Get leads to enrich
        const allLeads = await listLeads(organizationId);
        const toEnrich = leadId
          ? allLeads.filter((l) => l.id === leadId)
          : allLeads.filter((l) => l.pipelineStage === "discovered" && l.enrichmentAttempts < 3);

        let enriched = 0;
        let failed = 0;

        for (const lead of toEnrich) {
          // Mark as enriching
          await updateLead(lead.id, { pipelineStage: "enriching", enrichmentAttempts: lead.enrichmentAttempts + 1 });

          const result = await enrichAndScore(
            { id: lead.id, company: lead.company, ceo: lead.ceo, website: lead.website, whatTheyDo: lead.whatTheyDo, email: lead.email },
            orgContext,
          );

          if (result) {
            await updateLead(lead.id, {
              pipelineStage: "enriched",
              website: result.website || lead.website,
              whatTheyDo: result.whatTheyDo || lead.whatTheyDo,
              linkedin: result.linkedin || lead.linkedin,
              fit: result.fit,
              score: result.score,
              fitReason: result.fitReason,
            });
            enriched++;
          } else {
            const newAttempts = lead.enrichmentAttempts + 1;
            await updateLead(lead.id, {
              pipelineStage: newAttempts >= 3 ? "failed" : "discovered",
              enrichmentAttempts: newAttempts,
            });
            failed++;
          }
        }

        return Response.json({ ok: true, enriched, failed, total: toEnrich.length });
      },
    },
  },
});
