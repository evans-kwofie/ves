import { describe, expect, it } from "vitest";
import { filterPriorityQueue, isLeadStale, needsLeadVerification } from "./lead-priority";
import type { Lead } from "~/types/lead";

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: "lead", organizationId: "org", company: "Company", website: "", whatTheyDo: "", ceo: "", email: "person@example.com",
  linkedin: "", fit: "MEDIUM", fitReason: null, score: 50, status: "not_contacted", pipelineStage: "validated", enrichmentAttempts: 0,
  isValid: true, validationErrors: [], websiteValid: true, personValid: true, companyValid: true, validatedAt: null,
  source: null, sourceDetails: {}, lastVerifiedAt: "2026-08-20T00:00:00.000Z", enrichedAt: null, role: null, industry: null,
  companySize: null, location: null, intentSignals: [], engagementHistory: [], scoreBreakdown: {}, emailVerificationStatus: "verified",
  emailVerificationConfidence: 95, emailVerificationProvider: "hunter", emailVerifiedAt: null, optedOutAt: null,
  emailSentAt: null, linkedinSentAt: null, instagramSentAt: null, repliedAt: null, notes: "", addedAt: "2026-08-01T00:00:00.000Z", ...overrides,
});

describe("lead priority queues", () => {
  const now = Date.parse("2026-08-21T00:00:00.000Z");

  it("keeps the highest-fit queue actionable and score ordered", () => {
    const result = filterPriorityQueue([lead({ id: "a", fit: "HIGH", score: 72 }), lead({ id: "b", fit: "HIGH", score: 90 }), lead({ id: "c", fit: "HIGH", optedOutAt: "2026-08-01" })], "highest_fit", now);
    expect(result.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("identifies stale and verification-needed leads from evidence", () => {
    expect(isLeadStale(lead({ lastVerifiedAt: "2026-07-20T00:00:00.000Z" }), now)).toBe(true);
    expect(needsLeadVerification(lead({ emailVerificationStatus: "accept_all" }))).toBe(true);
    expect(filterPriorityQueue([lead({ id: "old", lastVerifiedAt: "2026-07-20T00:00:00.000Z" })], "stale", now)).toHaveLength(1);
  });
});
