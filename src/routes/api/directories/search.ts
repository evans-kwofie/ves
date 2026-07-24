import { createFileRoute } from "@tanstack/react-router";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";

export type DirectoryKey =
  | "producthunt"
  | "g2"
  | "capterra"
  | "indiehackers"
  | "betalist"
  | "appsumo";

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

const DIRECTORIES: Record<
  DirectoryKey,
  { label: string; searchUrl: (q: string) => string }
> = {
  producthunt: {
    label: "Product Hunt",
    searchUrl: (q) =>
      `https://www.producthunt.com/search?q=${encodeURIComponent(q)}`,
  },
  g2: {
    label: "G2",
    searchUrl: (q) =>
      `https://www.g2.com/search#query=${encodeURIComponent(q)}`,
  },
  capterra: {
    label: "Capterra",
    searchUrl: (q) =>
      `https://www.capterra.com/search/?query=${encodeURIComponent(q)}`,
  },
  indiehackers: {
    label: "Indie Hackers",
    searchUrl: (q) =>
      `https://www.indiehackers.com/products?query=${encodeURIComponent(q)}`,
  },
  betalist: {
    label: "BetaList",
    searchUrl: (q) => `https://betalist.com/search?q=${encodeURIComponent(q)}`,
  },
  appsumo: {
    label: "AppSumo",
    searchUrl: (q) =>
      `https://appsumo.com/search/?query=${encodeURIComponent(q)}`,
  },
};

const RECENCY_CLAUSES: Record<string, string> = {
  week: "Focus on products launched or featured in the last 7 days.",
  month: "Focus on products launched or featured in the last 30 days.",
  year: "Focus on products launched or featured in the last 12 months.",
};

const requestSchema = z.object({
  organizationId: z.string().min(1),
  directory: z.enum([
    "producthunt",
    "g2",
    "capterra",
    "indiehackers",
    "betalist",
    "appsumo",
  ]),
  query: z.string().min(1).max(200),
  recency: z.enum(["week", "month", "year"]).optional(),
});

const PH_GRAPHQL = "https://api.producthunt.com/v2/api/graphql";

const RECENCY_CUTOFFS: Record<string, number> = {
  week: 7,
  month: 30,
  year: 365,
};

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  website: string | null;
  url: string;
  votesCount: number;
  createdAt: string;
  makers: Array<{ name: string; twitterUsername: string | null }>;
}

async function searchProductHunt(
  query: string,
  recency?: string,
): Promise<DirectoryResult[]> {
  const token = process.env.PRODUCT_HUNT_ACCESS_TOKEN;
  if (!token) throw new Error("PRODUCT_HUNT_ACCESS_TOKEN not configured");

  // PH GraphQL introspection — find what args posts accepts
  const introspectGql = `
    query {
      __type(name: "PostsConnection") { name }
      __schema {
        queryType {
          fields(includeDeprecated: true) {
            name
            args { name type { name kind ofType { name } } }
          }
        }
      }
    }
  `;

  const introspectRes = await fetch(PH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: introspectGql }),
  });
  const introspectData = await introspectRes.json();
  const postsField = (introspectData?.data?.__schema?.queryType?.fields ?? []).find(
    (f: { name: string }) => f.name === "posts",
  );
  console.log("[PH] posts field args:", JSON.stringify(postsField?.args, null, 2));

  const gql = `
    query Search($first: Int!) {
      posts(first: $first, order: VOTES) {
        edges {
          node {
            id
            name
            tagline
            website
            url
            votesCount
            createdAt
            makers {
              name
              twitterUsername
            }
          }
        }
      }
    }
  `;

  const res = await fetch(PH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: gql, variables: { first: 50 } }),
  });

  console.log("[PH] response status:", res.status);
  if (!res.ok) {
    const errText = await res.text();
    console.error("[PH] API error body:", errText);
    throw new Error(`Product Hunt API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { posts?: { edges?: Array<{ node: PHPost }> } };
    errors?: unknown;
  };

  console.log("[PH] raw response:", JSON.stringify(data, null, 2));

  let edges = data?.data?.posts?.edges ?? [];
  console.log("[PH] edges before keyword filter:", edges.length);

  // Keyword filter — match query terms against name + tagline
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  edges = edges.filter(({ node }) => {
    const text = `${node.name} ${node.tagline}`.toLowerCase();
    return terms.some((t) => text.includes(t));
  });
  console.log("[PH] edges after keyword filter:", edges.length);

  // Client-side recency filter
  if (recency && RECENCY_CUTOFFS[recency]) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RECENCY_CUTOFFS[recency]);
    edges = edges.filter(
      ({ node }) => new Date(node.createdAt) >= cutoff,
    );
    console.log("[PH] edges after recency filter:", edges.length);
  }

  console.log("[PH] returning", Math.min(edges.length, 10), "results");
  return edges.slice(0, 10).map(({ node }) => {
    const maker = node.makers?.[0] ?? null;
    const launchedAt = node.createdAt
      ? new Date(node.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : null;

    return {
      company: node.name,
      founderName:
        maker?.name && maker.name !== "[REDACTED]" ? maker.name : null,
      whatTheyDo: node.tagline,
      website: node.website ?? "",
      email: null,
      linkedinHint: maker?.twitterUsername
        ? `https://twitter.com/${maker.twitterUsername}`
        : null,
      directoryUrl: node.url,
      launchedAt,
    };
  });
}

const mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function searchWithAgent(
  directoryKey: DirectoryKey,
  query: string,
  recency?: string,
): Promise<DirectoryResult[]> {
  const dir = DIRECTORIES[directoryKey];
  const searchUrl = dir.searchUrl(query);
  const recencyClause = recency ? (RECENCY_CLAUSES[recency] ?? "") : "";

  const prompt = `You are a B2B sales researcher. Search ${dir.label} for companies matching "${query}".
${recencyClause}

Use web search to browse ${searchUrl} and find 8 real product listings.

For each product return a JSON object with these fields:
- company: company or product name
- founderName: founder or CEO full name — null if not found
- whatTheyDo: one sentence describing what it does and who it's for
- website: the company's own domain (NOT the directory URL) — empty string if not found
- email: null — never guess or construct
- linkedinHint: null — never guess or construct
- directoryUrl: the full URL of their listing on ${dir.label}
- launchedAt: approximate launch date if shown (e.g. "March 2026"), or null

Rules: only real listings visible on the page, no duplicates, return a JSON array only.`;

  const response = await mistralClient.agents.complete({
    agentId: process.env.MISTRAL_AGENT_ID!,
    messages: [{ role: "user", content: prompt }],
  });

  const messageContent = response.choices?.[0]?.message?.content;
  let rawText = "";
  if (typeof messageContent === "string") {
    rawText = messageContent;
  } else if (Array.isArray(messageContent)) {
    for (const chunk of messageContent) {
      if (
        typeof chunk === "object" &&
        chunk !== null &&
        "type" in chunk &&
        chunk.type === "text" &&
        "text" in chunk
      ) {
        rawText += String(chunk.text);
      }
    }
  }

  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && "company" in item,
      )
      .map((item) => ({
        company: String(item.company ?? ""),
        founderName: item.founderName ? String(item.founderName) : null,
        whatTheyDo: String(item.whatTheyDo ?? ""),
        website: String(item.website ?? ""),
        email: null,
        linkedinHint: null,
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
          return new Response(
            JSON.stringify({ error: parsed.error.flatten() }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { directory, query, recency } = parsed.data;

        const results =
          directory === "producthunt"
            ? await searchProductHunt(query, recency)
            : await searchWithAgent(directory, query, recency);
        return Response.json({
          results,
          directory,
          directoryLabel: DIRECTORIES[directory].label,
        });
      },
    },
  },
});
