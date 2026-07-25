import { load } from "cheerio";
import { geminiJSON } from "./gemini";
import type { DirectoryResult } from "~/routes/api/directories/search";

const FETCH_TIMEOUT_MS = 6000;

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Vesper/1.0; +https://vesper.so)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = load(html);

    // Remove noise
    $("script, style, nav, footer, iframe, noscript, svg").remove();

    // Grab meta description
    const metaDesc =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Visible text from body, collapsed
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    return `${metaDesc}\n\n${bodyText}`.slice(0, 3000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function extractEmails(text: string): string[] {
  const matches = text.match(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  );
  if (!matches) return [];
  // Filter out obviously fake/placeholder emails
  return [
    ...new Set(
      matches.filter(
        (e) =>
          !e.includes("example.") &&
          !e.includes("placeholder") &&
          !e.includes("sentry") &&
          !e.includes("@2x") &&
          !e.endsWith(".png") &&
          !e.endsWith(".jpg"),
      ),
    ),
  ];
}

function extractLinkedIn(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/,
  );
  return match?.[0] ?? null;
}

async function enrichWithMistral(
  company: string,
  tagline: string,
  pageText: string,
  emailHints: string[],
  linkedinHint: string | null,
): Promise<{
  founderName: string | null;
  email: string | null;
  linkedinHint: string | null;
  whatTheyDo: string | null;
}> {
  const prompt = `You are analyzing a company's website to extract key information for a B2B sales team.

Company: ${company}
Tagline: ${tagline}
Emails found on site: ${emailHints.length > 0 ? emailHints.join(", ") : "none"}
LinkedIn found: ${linkedinHint ?? "none"}

Website content:
"""
${pageText.slice(0, 2000)}
"""

Extract the following and return as JSON:
- founderName: Full name of the founder or CEO. null if not found.
- email: The best contact email for the founder or company. Prefer founder email over generic ones (e.g. prefer john@company.com over hello@company.com). Only use emails from the list above — never invent one. null if none found.
- linkedinHint: LinkedIn profile URL of the founder/CEO. Use the one found above if valid, or extract from the page content. null if not found.
- whatTheyDo: A clear one-sentence description of what this product does and who it's for. Improve on the tagline if you can.

Return only valid JSON, no markdown.`;

  try {
    const parsed = await geminiJSON<{
      founderName?: string | null;
      email?: string | null;
      linkedinHint?: string | null;
      whatTheyDo?: string | null;
    }>(prompt, { maxTokens: 300 });
    return {
      founderName: parsed.founderName ?? null,
      email: parsed.email ?? null,
      linkedinHint: parsed.linkedinHint ?? null,
      whatTheyDo: parsed.whatTheyDo ?? null,
    };
  } catch {
    return { founderName: null, email: null, linkedinHint: null, whatTheyDo: null };
  }
}

async function resolvePhRedirect(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // HTTP redirect worked
    if (!res.url.includes("producthunt.com")) return res.url;

    // Fallback: parse HTML for meta refresh or JS redirect
    const html = await res.text();
    const metaRefresh = html.match(/content="0;\s*url=([^"]+)"/i)?.[1];
    if (metaRefresh) return metaRefresh;
    const jsRedirect = html.match(
      /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/,
    )?.[1];
    if (jsRedirect && jsRedirect.startsWith("http")) return jsRedirect;

    return res.url;
  } catch {
    return url;
  }
}

async function enrichOne(result: DirectoryResult): Promise<DirectoryResult> {
  if (!result.website) return result;

  const raw = result.website.startsWith("http")
    ? result.website
    : `https://${result.website}`;

  const url = raw.includes("producthunt.com/r/")
    ? await resolvePhRedirect(raw)
    : raw;

  console.log(`[enrich] resolved to ${url}`);

  const pageText = await fetchPageText(url);

  if (!pageText) {
    console.log(`[enrich] no content from ${url}`);
    return { ...result, website: url };
  }

  const emailHints = extractEmails(pageText);
  const linkedinFromPage = extractLinkedIn(pageText);

  console.log(`[enrich] ${result.company} — emails: ${emailHints.join(", ") || "none"}, linkedin: ${linkedinFromPage ?? "none"}`);

  const enriched = await enrichWithMistral(
    result.company,
    result.whatTheyDo,
    pageText,
    emailHints,
    linkedinFromPage ?? result.linkedinHint,
  );

  return {
    ...result,
    website: url, // store resolved domain, not PH redirect
    founderName: enriched.founderName ?? result.founderName,
    email: enriched.email ?? result.email,
    linkedinHint: enriched.linkedinHint ?? linkedinFromPage ?? result.linkedinHint,
    whatTheyDo: enriched.whatTheyDo ?? result.whatTheyDo,
  };
}

/**
 * Enrich a batch of directory results by scraping their websites.
 * Runs concurrently with a max of 5 parallel requests.
 */
export async function enrichResults(
  results: DirectoryResult[],
): Promise<DirectoryResult[]> {
  const CONCURRENCY = 5;
  const enriched: DirectoryResult[] = [];

  for (let i = 0; i < results.length; i += CONCURRENCY) {
    const batch = results.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(enrichOne));
    enriched.push(...batchResults);
  }

  return enriched;
}
