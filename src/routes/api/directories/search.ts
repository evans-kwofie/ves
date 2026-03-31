import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export type DirectoryKey = "producthunt" | "g2" | "capterra" | "indiehackers" | "betalist" | "appsumo";

export interface DirectoryResult {
  company: string;
  founderName: string | null;
  whatTheyDo: string;
  website: string;
  email: string | null;
  linkedinHint: string | null;
  directoryUrl: string;
  launchedAt: string | null;
}

const DIRECTORIES: Record<DirectoryKey, { label: string; searchUrl: (q: string) => string }> = {
  producthunt: {
    label: "Product Hunt",
    searchUrl: (q) => `https://www.producthunt.com/search?q=${encodeURIComponent(q)}`,
  },
  g2: {
    label: "G2",
    searchUrl: (q) => `https://www.g2.com/search#query=${encodeURIComponent(q)}`,
  },
  capterra: {
    label: "Capterra",
    searchUrl: (q) => `https://www.capterra.com/search/?query=${encodeURIComponent(q)}`,
  },
  indiehackers: {
    label: "Indie Hackers",
    searchUrl: (q) => `https://www.indiehackers.com/products?query=${encodeURIComponent(q)}`,
  },
  betalist: {
    label: "BetaList",
    searchUrl: (q) => `https://betalist.com/search?q=${encodeURIComponent(q)}`,
  },
  appsumo: {
    label: "AppSumo",
    searchUrl: (q) => `https://appsumo.com/search/?query=${encodeURIComponent(q)}`,
  },
};

const RECENCY_CLAUSES: Record<string, string> = {
  week: "Focus on products launched or featured in the last 7 days.",
  month: "Focus on products launched or featured in the last 30 days.",
  year: "Focus on products launched or featured in the last 12 months.",
};

const requestSchema = z.object({
  organizationId: z.string().min(1),
  directory: z.enum(["producthunt", "g2", "capterra", "indiehackers", "betalist", "appsumo"]),
  query: z.string().min(1).max(200),
  recency: z.enum(["week", "month", "year"]).optional(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });

async function searchDirectory(
  directoryKey: DirectoryKey,
  query: string,
  recency?: string
): Promise<DirectoryResult[]> {
  const dir = DIRECTORIES[directoryKey];
  const searchUrl = dir.searchUrl(query);
  const recencyClause = recency ? (RECENCY_CLAUSES[recency] ?? "") : "";

  const prompt = `You are a B2B sales researcher. Search ${dir.label} for companies matching "${query}".
${recencyClause}

Use web_search to browse ${searchUrl} and find 8 real product listings.

For each product return a JSON object with these fields:
- company: company or product name
- founderName: founder or CEO full name — null if not found
- whatTheyDo: one sentence describing what it does and who it's for
- website: the company's own domain (NOT the directory URL) — empty string if not found
- email: founder or contact email ONLY if explicitly visible on their listing or website. Set to null if not found. NEVER guess, construct, or infer an email address.
- linkedinHint: founder LinkedIn profile URL or slug ONLY if explicitly shown on their listing or profile. Set to null if not found. Never construct one.
- directoryUrl: the full URL of their listing on ${dir.label}
- launchedAt: approximate launch date if shown on the listing (e.g. "March 2026"), or null

Critical rules:
- Only return information you can actually see on the page — never infer, guess, or construct emails or LinkedIn URLs
- Only real verified products with real listings
- No duplicates
- Return a JSON array only, no markdown, no explanation outside the JSON`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const }],
    messages: [{ role: "user", content: prompt }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming);

  let rawText = "";
  for (const block of response.content) {
    if (block.type === "text") rawText += block.text;
  }

  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && "company" in item)
      .map((item) => ({
        company: String(item.company ?? ""),
        founderName: item.founderName ? String(item.founderName) : null,
        whatTheyDo: String(item.whatTheyDo ?? ""),
        website: String(item.website ?? ""),
        email: item.email ? String(item.email) : null,
        linkedinHint: item.linkedinHint ? String(item.linkedinHint) : null,
        directoryUrl: String(item.directoryUrl ?? ""),
        launchedAt: item.launchedAt ? String(item.launchedAt) : null,
      }));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/directories/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { directory, query, recency } = parsed.data;
        const results = await searchDirectory(directory, query, recency);
        return Response.json({ results, directory, directoryLabel: DIRECTORIES[directory].label });
      },
    },
  },
});
