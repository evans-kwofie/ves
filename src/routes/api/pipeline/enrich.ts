import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { listLeads, updateLead } from "~/db/queries/leads";
import { geminiSearch } from "~/agent/tools/gemini";
import { z } from "zod";
import { findEmail, splitName } from "~/agent/tools/find-email";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().optional(),
});

const enrichSchema = z.object({
  realName: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  whatTheyDo: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  fit: z.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z.number().int().min(0).max(100),
  fitReason: z.string(),
});

async function fetchRedditProfile(username: string): Promise<string> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: { "User-Agent": process.env.REDDIT_USER_AGENT ?? "nextreach/1.0" },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { data?: { subreddit?: { public_description?: string }; icon_img?: string } };
    return data?.data?.subreddit?.public_description ?? "";
  } catch {
    return "";
  }
}

async function enrichRedditLead(
  lead: { id: string; ceo: string; notes: string },
  orgContext: { name: string; description: string; industry: string; focusAreas: string[] },
): Promise<z.infer<typeof enrichSchema> | null> {
  const username = lead.ceo.replace(/^u\//, "");
  const profileBio = await fetchRedditProfile(username);

  const prompt = `You are enriching a lead discovered from Reddit. The Reddit username is u/${username}.

${profileBio ? `Their Reddit profile bio:\n${profileBio}\n` : ""}
Context from their post:\n${lead.notes.slice(0, 600)}

Selling org context:
- Company: ${orgContext.name}
- What they do: ${orgContext.description || "not provided"}
- Industry: ${orgContext.industry || "not provided"}
- Focus areas: ${orgContext.focusAreas.join(", ") || "not provided"}

Tasks:
1. Search for "u/${username}" or "${username}" on Reddit, LinkedIn, Twitter/X, and personal websites to find who this person really is
2. Find their real name, company, role, website, and LinkedIn profile
3. If you find their real name and company domain, infer a likely email
4. Score this lead against the selling org's ICP based on what you know about them

Return ONLY JSON:
{
  "realName": "First Last or null",
  "company": "Company name or null",
  "website": "https://... or null",
  "whatTheyDo": "One sentence about the company",
  "email": "email or null — only include if highly confident, never guess",
  "linkedin": "https://linkedin.com/in/... or null",
  "fit": "HIGH | MEDIUM | LOW",
  "score": 0-100,
  "fitReason": "One sentence"
}`;

  try {
    const text = await geminiSearch(prompt, { maxTokens: 600 });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = enrichSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function enrichStandardLead(
  lead: { id: string; company: string; ceo: string; website: string; whatTheyDo: string; email: string },
  orgContext: { name: string; description: string; industry: string; focusAreas: string[] },
): Promise<z.infer<typeof enrichSchema> | null> {
  const prompt = `You are enriching a B2B sales lead and scoring it against an ICP.

Lead:
- Company: ${lead.company}
- CEO/Contact: ${lead.ceo}
- Current website: ${lead.website || "unknown"}
- Current description: ${lead.whatTheyDo || "unknown"}

Selling org context:
- Company: ${orgContext.name}
- What they do: ${orgContext.description || "not provided"}
- Industry: ${orgContext.industry || "not provided"}
- Focus areas: ${orgContext.focusAreas.join(", ") || "not provided"}

Tasks:
1. Search for the company to verify their website and description
2. Find the real LinkedIn profile URL for ${lead.ceo} at ${lead.company}
3. Score this lead against the selling org's ICP

Return ONLY JSON:
{
  "company": "verified company name",
  "website": "https://...",
  "whatTheyDo": "one sentence",
  "linkedin": "https://linkedin.com/in/... or null",
  "fit": "HIGH | MEDIUM | LOW",
  "score": 0-100,
  "fitReason": "one sentence"
}`;

  try {
    const text = await geminiSearch(prompt, { maxTokens: 500 });
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
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "organizationId required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        const { organizationId, leadId } = parsed.data;

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

        const allLeads = await listLeads(organizationId);
        const toEnrich = leadId
          ? allLeads.filter((l) => l.id === leadId)
          : allLeads.filter((l) => l.pipelineStage === "discovered" && l.enrichmentAttempts < 3);

        let enriched = 0;
        let failed = 0;

        for (const lead of toEnrich) {
          await updateLead(lead.id, { pipelineStage: "enriching", enrichmentAttempts: lead.enrichmentAttempts + 1 });

          const isRedditLead = lead.source === "reddit" || lead.website?.includes("reddit.com/user/");

          const result = isRedditLead
            ? await enrichRedditLead({ id: lead.id, ceo: lead.ceo, notes: lead.notes }, orgContext)
            : await enrichStandardLead({ id: lead.id, company: lead.company, ceo: lead.ceo, website: lead.website, whatTheyDo: lead.whatTheyDo, email: lead.email }, orgContext);

          if (!result) {
            await updateLead(lead.id, {
              pipelineStage: lead.enrichmentAttempts + 1 >= 3 ? "failed" : "discovered",
            });
            failed++;
            continue;
          }

          // Use Hunter.io to find a verified email
          const nameForHunter = result.realName ?? lead.ceo;
          const domainForHunter = result.website ?? lead.website;
          const { firstName, lastName } = splitName(nameForHunter);
          const hunterResult = await findEmail(firstName, lastName, domainForHunter);

          const finalEmail = hunterResult.email ?? (result.email && !result.email.includes("placeholder") ? result.email : null);

          await updateLead(lead.id, {
            pipelineStage: "enriched",
            ...(isRedditLead && result.realName ? { ceo: result.realName } : {}),
            ...(isRedditLead && result.company ? { company: result.company } : {}),
            website: result.website || lead.website,
            whatTheyDo: result.whatTheyDo || lead.whatTheyDo,
            linkedin: result.linkedin || lead.linkedin,
            fit: result.fit,
            score: result.score,
            fitReason: result.fitReason,
            ...(finalEmail ? { email: finalEmail } : {}),
          });

          enriched++;
        }

        return Response.json({ ok: true, enriched, failed, total: toEnrich.length });
      },
    },
  },
});
