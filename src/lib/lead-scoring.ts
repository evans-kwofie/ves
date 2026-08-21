import type { FitRating } from "~/types/lead";

/** Transparent baseline score; AI enrichment may refine the evidence, not hide it. */
export function scoreLead(input: { website?: string; email?: string | null; linkedin?: string; intentSignals?: string[]; role?: string | null; industry?: string | null; companySize?: string | null; location?: string | null; targetIndustry?: string; aiScore?: number }): { score: number; fit: FitRating; breakdown: Record<string, number> } {
  const role = input.role?.toLowerCase() ?? "";
  const decisionMaker = /\b(founder|owner|ceo|chief|vp|vice president|director|head of)\b/.test(role);
  const industryMatches = Boolean(input.industry && input.targetIndustry && input.industry.toLowerCase().includes(input.targetIndustry.toLowerCase()));
  const size = input.companySize?.toLowerCase() ?? "";
  const breakdown = {
    companyContext: input.website ? 20 : 0,
    contactChannel: input.email || input.linkedin ? 20 : 0,
    intent: Math.min(30, (input.intentSignals?.length ?? 0) * 15),
    role: decisionMaker ? 10 : input.role ? 4 : 0,
    industry: industryMatches ? 10 : input.industry ? 4 : 0,
    companySize: /\b(2|3|4|5|10|11|20|50|51|100|200)\b/.test(size) ? 8 : input.companySize ? 3 : 0,
    location: input.location ? 5 : 0,
    enrichment: input.aiScore == null ? 0 : Math.round(input.aiScore * 0.3),
  };
  const score = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return { score, fit: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW", breakdown };
}
