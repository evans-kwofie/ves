import { geminiSearch } from "~/agent/tools/gemini";
import { z } from "zod";

export const enrichSchema = z.object({
  realName: z.string().optional(), company: z.string().optional(), website: z.string().optional(), whatTheyDo: z.string().optional(), email: z.string().optional(), linkedin: z.string().optional(), role: z.string().optional(), industry: z.string().optional(), companySize: z.string().optional(), location: z.string().optional(),
  publicSignals: z.array(z.object({ summary: z.string().min(1).max(280), sourceUrl: z.string().url(), publishedAt: z.string().max(80).optional() })).max(3).default([]),
  fit: z.enum(["HIGH", "MEDIUM", "LOW"]), score: z.number().int().min(0).max(100), fitReason: z.string(),
});
export type EnrichmentResult = z.infer<typeof enrichSchema>;
export type OrgEnrichmentContext = { name: string; description: string; industry: string; focusAreas: string[]; icp: string; messaging: string };

function isHttpUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; } }

export function validateLead(input: { company: string; person: string; website: string; email: string | null; linkedin: string; source: string | null }) {
  const companyValid = input.company.trim().length >= 2;
  const personValid = input.person.trim().length >= 2;
  const websiteValid = isHttpUrl(input.website);
  const hasContactChannel = Boolean(input.email || input.linkedin || input.source === "instagram");
  const validationErrors = [!companyValid ? "Company name is missing or too short" : null, !websiteValid ? "A valid website or profile URL is required" : null, !hasContactChannel ? "No outreach contact channel is available" : null].filter((error): error is string => Boolean(error));
  return { companyValid, personValid, websiteValid, validationErrors, isValid: validationErrors.length === 0 };
}

async function fetchRedditProfile(username: string): Promise<string> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, { headers: { "User-Agent": process.env.REDDIT_USER_AGENT ?? "nextreach/1.0" } });
    if (!res.ok) return "";
    const data = (await res.json()) as { data?: { subreddit?: { public_description?: string } } };
    return data.data?.subreddit?.public_description ?? "";
  } catch { return ""; }
}

function parseResult(text: string): EnrichmentResult | null {
  try { const match = text.match(/\{[\s\S]*\}/); if (!match) return null; const parsed = enrichSchema.safeParse(JSON.parse(match[0])); return parsed.success ? parsed.data : null; } catch { return null; }
}

export async function enrichRedditLead(lead: { id: string; ceo: string; notes: string }, org: OrgEnrichmentContext): Promise<EnrichmentResult | null> {
  const username = lead.ceo.replace(/^u\//, "");
  const profileBio = await fetchRedditProfile(username);
  const prompt = `You are enriching a lead discovered from Reddit. The Reddit username is u/${username}.

${profileBio ? `Their Reddit profile bio:\n${profileBio}\n` : ""}Context from their post:\n${lead.notes.slice(0, 600)}

Selling org context:\n- Company: ${org.name}\n- What they do: ${org.description || "not provided"}\n- Industry: ${org.industry || "not provided"}\n- Focus areas: ${org.focusAreas.join(", ") || "not provided"}\n- Ideal customer profile: ${org.icp || "not provided"}\n- Positioning and proof: ${org.messaging || "not provided"}

Tasks:\n1. Search for "u/${username}" or "${username}" on Reddit, LinkedIn, Twitter/X, and personal websites to find who this person really is\n2. Find their real name, company, role, website, and LinkedIn profile\n3. If you find their real name and company domain, infer a likely email\n4. Find up to 3 recent, relevant public signals (a post, launch, announcement, hiring change, or business event) with direct source URLs. Never invent one; return an empty list if none are verifiable.\n5. Score this lead against the selling org's ICP based on what you know about them

Return ONLY JSON:\n{ "realName": "First Last or null", "company": "Company name or null", "website": "https://... or null", "whatTheyDo": "One sentence about the company", "email": "email or null — only include if highly confident, never guess", "linkedin": "https://linkedin.com/in/... or null", "role": "role or null", "industry": "industry or null", "companySize": "size band or null", "location": "location or null", "publicSignals": [{ "summary": "what happened and why it matters", "sourceUrl": "https://public-source.example", "publishedAt": "optional date" }], "fit": "HIGH | MEDIUM | LOW", "score": 0-100, "fitReason": "One sentence" }`;
  try { return parseResult(await geminiSearch(prompt, { maxTokens: 600 })); } catch { return null; }
}

export async function enrichStandardLead(lead: { id: string; company: string; ceo: string; website: string; whatTheyDo: string; email: string }, org: OrgEnrichmentContext): Promise<EnrichmentResult | null> {
  const prompt = `You are enriching a B2B sales lead and scoring it against an ICP.

Lead:\n- Company: ${lead.company}\n- CEO/Contact: ${lead.ceo}\n- Current website: ${lead.website || "unknown"}\n- Current description: ${lead.whatTheyDo || "unknown"}

Selling org context:\n- Company: ${org.name}\n- What they do: ${org.description || "not provided"}\n- Industry: ${org.industry || "not provided"}\n- Focus areas: ${org.focusAreas.join(", ") || "not provided"}\n- Ideal customer profile: ${org.icp || "not provided"}\n- Positioning and proof: ${org.messaging || "not provided"}

Tasks:\n1. Search for the company to verify their website and description\n2. Find the real LinkedIn profile URL for ${lead.ceo} at ${lead.company}\n3. Find up to 3 recent, relevant public signals (a post, launch, announcement, hiring change, or business event) with direct source URLs. Never invent one; return an empty list if none are verifiable.\n4. Score this lead against the selling org's ICP

Return ONLY JSON:\n{ "company": "verified company name", "website": "https://...", "whatTheyDo": "one sentence", "linkedin": "https://linkedin.com/in/... or null", "role": "contact role or null", "industry": "industry or null", "companySize": "size band or null", "location": "location or null", "publicSignals": [{ "summary": "what happened and why it matters", "sourceUrl": "https://public-source.example", "publishedAt": "optional date" }], "fit": "HIGH | MEDIUM | LOW", "score": 0-100, "fitReason": "one sentence" }`;
  try { return parseResult(await geminiSearch(prompt, { maxTokens: 500 })); } catch { return null; }
}
