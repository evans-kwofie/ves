import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("../client", () => ({ db: { execute } }));

describe("getABSummary", () => {
  beforeEach(() => execute.mockReset());

  it("attributes replies to each lead's first sent A/B exposure", async () => {
    execute
      .mockResolvedValueOnce({ rows: [
        { campaign_id: "campaign-1", ab_variant: "a", sent: 10 },
        { campaign_id: "campaign-1", ab_variant: "b", sent: 10 },
      ] })
      .mockResolvedValueOnce({ rows: [
        { campaign_id: "campaign-1", ab_variant: "a", replied: 3 },
        { campaign_id: "campaign-1", ab_variant: "b", replied: 1 },
      ] });

    const { getABSummary } = await import("./analytics");
    await expect(getABSummary("org-1")).resolves.toEqual({ campaignsWithAB: 1, aWins: 1, bWins: 0, tied: 0 });

    for (const [query] of execute.mock.calls) {
      expect(query.sql).toContain("DISTINCT ON (cd.campaign_id, cd.lead_id)");
      expect(query.sql).toContain("ORDER BY cd.campaign_id, cd.lead_id, cd.sent_at ASC");
    }
  });
});

describe("getStepDropoff", () => {
  beforeEach(() => execute.mockReset());

  it("attributes each campaign reply to the latest sent step before the outcome", async () => {
    execute
      .mockResolvedValueOnce({ rows: [
        { campaign_id: "campaign-1", campaign_name: "Launch", step_number: 1, sent: 10 },
        { campaign_id: "campaign-1", campaign_name: "Launch", step_number: 2, sent: 8 },
      ] })
      .mockResolvedValueOnce({ rows: [{ campaign_id: "campaign-1", step_number: 2, replied: 2 }] });

    const { getStepDropoff } = await import("./analytics");
    await expect(getStepDropoff("org-1")).resolves.toEqual([
      { campaignId: "campaign-1", campaignName: "Launch", stepNumber: 1, sent: 10, replied: 0, replyRate: 0 },
      { campaignId: "campaign-1", campaignName: "Launch", stepNumber: 2, sent: 8, replied: 2, replyRate: 25 },
    ]);

    expect(execute.mock.calls[1][0].sql).toContain("DISTINCT ON (oe.id)");
    expect(execute.mock.calls[1][0].sql).toContain("ORDER BY oe.id, cd.sent_at DESC");
  });
});
