import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Campaign } from "~/types/campaign";
import type { CampaignStep } from "~/db/queries/steps";
import type { Lead } from "~/types/lead";

const geminiJSON = vi.fn();
const upsertDraft = vi.fn();
const getLatestDraftBeforeStep = vi.fn();

vi.mock("~/agent/tools/gemini", () => ({ geminiJSON }));
vi.mock("~/db/queries/drafts", () => ({ upsertDraft, getLatestDraftBeforeStep }));

const campaign: Campaign = {
  id: "campaign-1", organizationId: "org-1", name: "Test campaign", status: "draft",
  channels: ["instagram"], goal: null, intentType: null, runFrequency: null, lastRunAt: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  leadCount: 1, sentCount: 0, replyCount: 0,
};

const lead: Lead = {
  id: "lead-1", organizationId: "org-1", company: "Acme Fitness", website: "https://acme.test",
  whatTheyDo: "Online fitness coaching", ceo: "Sam Lee", email: "sam@acme.test", linkedin: "",
  fit: "HIGH", fitReason: "Strong ICP", score: 91, status: "not_contacted", pipelineStage: "validated",
  enrichmentAttempts: 0, isValid: true, validationErrors: [], websiteValid: true, personValid: true,
  companyValid: true, validatedAt: null, source: "instagram", emailSentAt: null, linkedinSentAt: null,
  instagramSentAt: null, repliedAt: null, notes: "", addedAt: "2026-01-01T00:00:00.000Z",
};

function step(overrides: Partial<CampaignStep> = {}): CampaignStep {
  return {
    id: "step-1", campaignId: campaign.id, stepNumber: 1, delayDays: 0, channel: "instagram",
    linkedinType: null, context: null, templateId: null, createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

describe("generateDraftForLead", () => {
  beforeEach(() => {
    geminiJSON.mockReset().mockResolvedValue({ subject: "Should be removed", body: "A personal message" });
    upsertDraft.mockReset().mockImplementation(async (input) => input);
    getLatestDraftBeforeStep.mockReset().mockResolvedValue(null);
  });

  it("creates an Instagram draft for an Instagram sequence step", async () => {
    const { generateDraftForLead } = await import("./draft-content");

    await generateDraftForLead({ campaign, lead, step: step(), orgProfile: {} });

    expect(upsertDraft).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: campaign.id,
      leadId: lead.id,
      channel: "instagram",
      subject: null,
    }));
    expect(geminiJSON).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      system: expect.stringContaining("Instagram DM"),
    }));
  });

  it("preserves a LinkedIn connection request as its own draft channel", async () => {
    const { generateDraftForLead } = await import("./draft-content");

    await generateDraftForLead({
      campaign: { ...campaign, channels: ["linkedin"] },
      lead,
      step: step({ channel: "linkedin", linkedinType: "connect" }),
      orgProfile: {},
    });

    expect(upsertDraft).toHaveBeenCalledWith(expect.objectContaining({
      channel: "linkedin_connect",
      subject: null,
    }));
    expect(geminiJSON).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      system: expect.stringContaining("Connection Request"),
    }));
  });

  it("refuses to create a draft for an unsupported Reddit publishing step", async () => {
    const { generateDraftForLead } = await import("./draft-content");

    await expect(generateDraftForLead({
      campaign: { ...campaign, channels: ["reddit"] },
      lead,
      step: step({ channel: "reddit" }),
      orgProfile: {},
    })).rejects.toThrow("Reddit campaign publishing is not supported yet");

    expect(geminiJSON).not.toHaveBeenCalled();
    expect(upsertDraft).not.toHaveBeenCalled();
  });

  it("grounds a follow-up in the prior message without reusing it", async () => {
    getLatestDraftBeforeStep.mockResolvedValue({ id: "draft-1", body: "We help fitness coaches fill their calendars. Open to a demo?" });
    const { generateDraftForLead } = await import("./draft-content");

    await generateDraftForLead({ campaign, lead, step: step({ stepNumber: 2 }), orgProfile: {} });

    expect(getLatestDraftBeforeStep).toHaveBeenCalledWith(campaign.id, lead.id, 2);
    expect(geminiJSON).toHaveBeenCalledWith(expect.stringContaining("PREVIOUS MESSAGE"), expect.any(Object));
    expect(geminiJSON.mock.calls[0][0]).toContain("Open to a demo?");
    expect(upsertDraft).toHaveBeenCalledWith(expect.objectContaining({
      generationContext: expect.objectContaining({ previousDraftId: "draft-1" }),
    }));
  });
});
