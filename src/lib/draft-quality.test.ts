import { describe, expect, it } from "vitest";
import { checkDraftQuality } from "./draft-quality";

describe("checkDraftQuality", () => {
  it("flags copy without prospect context when lead evidence exists", () => {
    expect(checkDraftQuality({ body: "Hi there — we help teams save time. Open to a chat?", channel: "email", prospect: { company: "Acme", whatTheyDo: "Payment infrastructure" } })).toContain("No prospect-specific context");
  });

  it("accepts a concise, contextual message", () => {
    expect(checkDraftQuality({ body: "Saw Acme is building payment infrastructure. Would you be open to a quick chat?", channel: "email", prospect: { company: "Acme", whatTheyDo: "Payment infrastructure" } })).not.toContain("No prospect-specific context");
  });

  it("flags a long dense block that will be difficult to read", () => {
    const body = `${Array.from({ length: 40 }, () => "extraordinary").join(" ")}. Acme's operationalization infrastructure is increasingly transformational because the organization is simultaneously navigating interoperability, decentralization, and internationalization requirements without a clear way to prioritize the work. Our comprehensive platform provides unprecedented visibility across every workflow and can help your team collaboratively operationalize the entire process while eliminating unnecessary complexity and improving organizational communication. Would you be open to a call so I can explain how this works in practice for your company and share a complete overview of the implementation approach?`;
    const issues = checkDraftQuality({ body, channel: "email" });

    expect(issues).toContain("Hard to scan — shorten long sentences");
    expect(issues).toContain("Dense wording — prefer plainer language");
    expect(issues).toContain("Long block of copy — add a paragraph break");
  });
});
