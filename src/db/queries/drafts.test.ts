import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("../client", () => ({ db: { execute } }));

describe("skipScheduledDraftsForLead", () => {
  beforeEach(() => execute.mockReset().mockResolvedValue({ rows: [] }));

  it("suppresses only scheduled follow-ups for the replying lead", async () => {
    const { skipScheduledDraftsForLead } = await import("./drafts");

    await skipScheduledDraftsForLead("lead-1");

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("SET status = 'skipped'"),
      args: expect.arrayContaining(["lead-1"]),
    }));
    expect(execute.mock.calls[0][0].sql).toContain("status = 'scheduled'");
  });
});

describe("scheduleDraftForNextStep", () => {
  beforeEach(() => execute.mockReset().mockResolvedValue({ rows: [] }));

  it("creates a separate blank draft for the next step without overwriting the sent draft", async () => {
    const { scheduleDraftForNextStep } = await import("./drafts");
    const sendAfter = "2026-08-22T09:00:00.000Z";

    await scheduleDraftForNextStep({
      campaignId: "campaign-1",
      leadId: "lead-1",
      nextStepNumber: 2,
      channel: "instagram",
      sendAfter,
    });

    const query = execute.mock.calls[0][0];
    expect(query.sql).toContain("INSERT INTO campaign_drafts");
    expect(query.sql).toContain("ON CONFLICT (campaign_id, lead_id, step_number)");
    expect(query.args).toEqual(expect.arrayContaining(["campaign-1", "lead-1", 2, "instagram", sendAfter]));
  });
});
