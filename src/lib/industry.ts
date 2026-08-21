const INDUSTRIES = ["SaaS", "Agency", "E-commerce", "Consulting", "Media & Content", "Healthcare", "Finance", "Education", "Other"] as const;
export type Industry = typeof INDUSTRIES[number];

export function normalizeIndustry(value: unknown): Industry | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (/saas|software|technology/.test(normalized)) return "SaaS";
  if (/agency|studio/.test(normalized)) return "Agency";
  if (/e[ -]?commerce|retail|shop/.test(normalized)) return "E-commerce";
  if (/consult/.test(normalized)) return "Consulting";
  if (/media|content|publish/.test(normalized)) return "Media & Content";
  if (/health|medical|clinic/.test(normalized)) return "Healthcare";
  if (/finance|fintech|bank|accounting/.test(normalized)) return "Finance";
  if (/education|learning|school|course/.test(normalized)) return "Education";
  if (normalized === "other") return "Other";
  return null;
}
