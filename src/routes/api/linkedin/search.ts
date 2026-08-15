import { createFileRoute } from "@tanstack/react-router";
import { geminiSearch } from "~/agent/tools/gemini";
import { z } from "zod";
import { createLead } from "~/db/queries/leads";
import { listActiveKeywordsWithSubreddits } from "~/db/queries/keywords";
import { findEmail, splitName } from "~/agent/tools/find-email";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  keyword: z.string().min(1).max(200).optional(),
  keywordId: z.string().optional(),
  runAll: z.boolean().optional(),
});

async function searchForKeyword(keyword: string): Promise<{
  company: string;
  name: string;
  whatTheyDo: string;
  website: string;
  linkedinHint: string;
}[]> {
  const prompt = `Find 5 real B2B companies where the founder or CEO would be an ideal outreach target for a product related to "${keyword}".

Return a JSON array only. Each item:
- company: company name
- name: founder or CEO full name
- whatTheyDo: one specific sentence about what the company does
- website: company website domain (e.g. example.com)
- linkedinHint: their LinkedIn profile slug or name hint (NOT a full URL, just a hint)

Rules: only real companies, no markdown, JSON array only.`;

  const rawText = await geminiSearch(prompt, { maxTokens: 1500 });

  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed
      .filter((item): item is Record<string, string> => typeof item === "object" && item !== null && "company" in item && "name" in item)
      .map((item) => ({
        company: String(item.company ?? ""),
        name: String(item.name ?? ""),
        whatTheyDo: String(item.whatTheyDo ?? ""),
        website: String(item.website ?? ""),
        linkedinHint: String(item.linkedinHint ?? ""),
      }));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/linkedin/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid request" }), { status: 422, headers: { "Content-Type": "application/json" } });

        const { organizationId, keyword, runAll } = parsed.data;

        let keywordsToRun: string[] = [];
        if (runAll) {
          const kws = await listActiveKeywordsWithSubreddits(organizationId);
          keywordsToRun = kws.map((k) => k.keyword);
        } else if (keyword) {
          keywordsToRun = [keyword];
        } else {
          return new Response(JSON.stringify({ error: "keyword or runAll required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        let totalSaved = 0;
        const allResults: { company: string; name: string; whatTheyDo: string; website: string; linkedinHint: string; keyword: string; saved: boolean }[] = [];

        for (const kw of keywordsToRun) {
          const results = await searchForKeyword(kw);
          for (const r of results) {
            const domain = r.website.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
            const { firstName, lastName } = splitName(r.name);
            const hunterResult = await findEmail(firstName, lastName, domain);
            const email = hunterResult.email ?? null;

            let saved = false;
            try {
              await createLead(organizationId, {
                company: r.company,
                website: r.website ? `https://${domain}` : "",
                whatTheyDo: r.whatTheyDo,
                ceo: r.name,
                email: email ?? `noemail-${r.company.toLowerCase().replace(/\s+/g, "-")}@placeholder.nextreach`,
                linkedin: r.linkedinHint ? `https://linkedin.com/in/${r.linkedinHint}` : "",
                fit: "MEDIUM",
                notes: `Discovered via keyword search: ${kw}${!email ? " — email not verified, needs manual lookup" : ` — email verified via Hunter (confidence: ${hunterResult.confidence})`}`,
              });
              saved = true;
              totalSaved++;
            } catch {
              // duplicate email — already in pipeline
            }
            allResults.push({ ...r, keyword: kw, saved });
          }
        }

        return Response.json({ results: allResults, totalSaved });
      },
    },
  },
});
