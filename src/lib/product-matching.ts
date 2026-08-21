export interface ProductProfile { id: string; name: string; description: string; benefits: string[]; idealCustomer: string | null; }
export interface ProductMatch { product: ProductProfile; matchedTerms: string[]; reason: string; score: number; evidence: { prospectTerms: string[]; publicContextTerms: string[] }; }
type ProductLeadContext = { company: string; whatTheyDo: string; industry: string | null; intentSignals: string[]; role?: string | null; companySize?: string | null; engagementHistory?: Record<string, unknown>[] };

export function matchProductToLead(products: ProductProfile[], lead: ProductLeadContext): ProductProfile | null {
  return explainProductMatch(products, lead)?.product ?? null;
}

function words(value: string, ignored: Set<string>) {
  return new Set(value.toLowerCase().match(/[a-z]{3,}/g)?.filter((word) => !ignored.has(word)) ?? []);
}

export function explainProductMatch(products: ProductProfile[], lead: ProductLeadContext): ProductMatch | null {
  const ignored = new Set(["with", "that", "this", "their", "they", "from", "into", "your", "about", "have", "what", "does", "company"]);
  const publicContext = (lead.engagementHistory ?? []).map((signal) => typeof signal.summary === "string" ? signal.summary : "").filter(Boolean).join(" ");
  const publicContextWords = words(publicContext, ignored);
  const prospectWords = words(`${lead.company} ${lead.whatTheyDo} ${lead.industry ?? ""} ${lead.role ?? ""} ${lead.companySize ?? ""} ${(lead.intentSignals ?? []).join(" ")}`, ignored);
  const ranked = products.map((product) => {
    const productWords = words(`${product.name} ${product.description} ${product.idealCustomer ?? ""} ${(product.benefits ?? []).join(" ")}`, ignored);
    const prospectTerms = [...productWords].filter((word) => prospectWords.has(word));
    const publicContextTerms = [...productWords].filter((word) => publicContextWords.has(word));
    const terms = [...new Set([...prospectTerms, ...publicContextTerms])];
    return { product: { ...product, benefits: product.benefits ?? [] }, terms, prospectTerms, publicContextTerms, score: prospectTerms.length + publicContextTerms.length * 2 };
  }).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return null;
  const reason = top.terms.length
    ? [
      top.publicContextTerms.length ? `Matches recent public context: ${top.publicContextTerms.slice(0, 2).join(", ")}` : null,
      top.prospectTerms.length ? `Matches prospect profile: ${top.prospectTerms.slice(0, 3).join(", ")}` : null,
    ].filter(Boolean).join(". ")
    : "Selected as the available offer; no strong keyword overlap found.";
  return { product: top.product, matchedTerms: top.terms, score: top.score, reason, evidence: { prospectTerms: top.prospectTerms, publicContextTerms: top.publicContextTerms } };
}
