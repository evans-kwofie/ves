import { describe, expect, it } from "vitest";
import { explainProductMatch } from "./product-matching";

describe("explainProductMatch", () => {
  it("selects the offer with overlapping prospect context and records the evidence", () => {
    const match = explainProductMatch([{ id: "one", name: "Pipeline automation", description: "Automate sales pipeline follow-up", benefits: ["Pipeline visibility"], idealCustomer: "Sales teams" }, { id: "two", name: "Content suite", description: "Publish better content", benefits: [], idealCustomer: "Marketing teams" }], { company: "Acme", whatTheyDo: "A sales pipeline platform", industry: "SaaS", intentSignals: ["sales"] });
    expect(match?.product.id).toBe("one");
    expect(match?.matchedTerms).toContain("pipeline");
  });

  it("prioritizes an offer supported by recent public prospect context", () => {
    const match = explainProductMatch([
      { id: "one", name: "Pipeline automation", description: "Automate sales pipeline follow-up", benefits: ["Pipeline visibility"], idealCustomer: "Sales teams" },
      { id: "two", name: "Hiring analytics", description: "Recruiting analytics for growing teams", benefits: ["Hiring visibility"], idealCustomer: "People teams" },
    ], {
      company: "Acme", whatTheyDo: "B2B software", industry: "SaaS", intentSignals: [],
      engagementHistory: [{ summary: "Acme is expanding its recruiting team and hiring operations staff." }],
    });

    expect(match?.product.id).toBe("two");
    expect(match?.evidence.publicContextTerms).toContain("hiring");
    expect(match?.reason).toContain("recent public context");
  });
});
