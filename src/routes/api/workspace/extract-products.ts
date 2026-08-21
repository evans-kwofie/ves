import { createFileRoute } from "@tanstack/react-router";
import { load } from "cheerio";
import { z } from "zod";
import { geminiJSON } from "~/agent/tools/gemini";
import { normalizeIndustry } from "~/lib/industry";

const requestSchema = z.object({ website: z.string().url() });
const productSchema = z.object({
  name: z.string().min(1).max(120), description: z.string().min(1).max(600), benefits: z.array(z.string().max(220)).max(6).default([]),
  idealCustomer: z.string().max(300).nullable().optional(), pricingModel: z.enum(["custom", "fixed", "starting_at", "usage_based"]).default("custom"),
  priceAmount: z.number().nonnegative().nullable().optional(), priceCurrency: z.string().length(3).nullable().optional(), offerTerms: z.string().max(400).nullable().optional(),
  qualificationConstraints: z.string().max(400).nullable().optional(), proofPoints: z.array(z.string().max(240)).max(5).default([]),
});
const responseSchema = z.object({
  products: z.array(productSchema).max(8),
  industry: z.unknown().optional(),
});

function isPublicWebsite(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!/^https?:$/.test(url.protocol) || host === "localhost" || host.endsWith(".local") || /^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  return true;
}
async function readPage(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "Nextreach product importer/1.0", Accept: "text/html" }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;
  return response.text();
}
async function pricingText(website: string) {
  const base = new URL(website); const home = await readPage(base.toString());
  const candidates = new Set([new URL("/pricing", base).toString(), new URL("/plans", base).toString()]);
  if (home) {
    const $ = load(home);
    $("a[href]").each((_, anchor) => { const href = $(anchor).attr("href"); if (href && /(pricing|plans|packages)/i.test(`${href} ${$(anchor).text()}`)) { try { const target = new URL(href, base); if (target.origin === base.origin) candidates.add(target.toString()); } catch { /* ignore malformed links */ } } });
  }
  for (const candidate of candidates) { const html = await readPage(candidate); if (html) { const $ = load(html); $("script, style, noscript, svg, nav, footer").remove(); const text = $("body").text().replace(/\s+/g, " ").trim(); if (text.length > 100) return { url: candidate, text: text.slice(0, 15_000) }; } }
  return null;
}

export const Route = createFileRoute("/api/workspace/extract-products")({ server: { handlers: { POST: async ({ request }) => {
  let body: unknown; try { body = await request.json(); } catch { body = {}; }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success || !isPublicWebsite(parsed.success ? parsed.data.website : "https://invalid.example")) return Response.json({ error: "Enter a public http(s) website" }, { status: 400 });
  try {
    const page = await pricingText(parsed.data.website);
    if (!page) return Response.json({ products: [], message: "No readable pricing page was found" });
    const extracted = await geminiJSON<unknown>(`Extract only the products or plans explicitly supported by this pricing page. If evidence supports it, include a short industry label; otherwise omit it. Do not invent pricing, results, customer types, or industry.\n\nPricing page URL: ${page.url}\n\nPage text:\n${page.text}`, { maxTokens: 2_000, thinkingBudget: 0, responseJsonSchema: { type: "object", properties: { products: { type: "array" }, industry: { type: "string" } }, required: ["products"] } });
    const products = responseSchema.safeParse(extracted);
    if (!products.success) return Response.json({ products: [], message: "The pricing page could not be understood" });
    return Response.json({ products: products.data.products, industry: normalizeIndustry(products.data.industry), pricingPage: page.url });
  } catch { return Response.json({ products: [], message: "We couldn't read a pricing page from that website" }); }
} } } });
