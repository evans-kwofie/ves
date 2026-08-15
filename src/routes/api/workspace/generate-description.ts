import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  website: z.string().url(),
  name: z.string().optional(),
});

async function scrapeWebsite(url: string): Promise<{
  title: string | null;
  description: string | null;
  bodyText: string | null;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Nextreach/1.0; +https://nextreach.app)",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return { title: null, description: null, bodyText: null };

  const html = await res.text();

  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']{1,200})["'][^>]+property=["']og:title["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ??
    null;

  const description =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:description["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i)?.[1] ??
    null;

  // Extract visible body text — strip tags, collapse whitespace, take first 1500 chars
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 1500)
    .trim() || null;

  return { title, description, bodyText };
}

export const Route = createFileRoute("/api/workspace/generate-description")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = {};
        try { body = await request.json(); } catch {}

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "A valid website URL is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { website } = parsed.data;
        console.log(`[generate-description] scraping ${website}`);

        let scraped: Awaited<ReturnType<typeof scrapeWebsite>> = {
          title: null, description: null, bodyText: null,
        };
        try {
          scraped = await scrapeWebsite(website);
          console.log(`[generate-description] scraped — title: ${scraped.title ?? "none"} | meta desc: ${scraped.description ? `${scraped.description.slice(0, 60)}…` : "none"} | body: ${scraped.bodyText ? `${scraped.bodyText.length} chars` : "none"}`);
        } catch (err) {
          console.warn("[generate-description] scrape failed:", err);
        }

        const description = scraped.description;

        if (!description) {
          console.warn(`[generate-description] no meta description found at ${website}`);
          return new Response(JSON.stringify({ error: "No description found on that website — add one manually" }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log(`[generate-description] done — "${description.slice(0, 80)}…"`);
        return Response.json({ description });
      },
    },
  },
});
