import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
const Webhook = vi.fn(function () { return { verify }; });
const getDraftByResendMessageId = vi.fn();
const updateDraft = vi.fn();
const getLead = vi.fn();
const updateLead = vi.fn();
const notifyBounce = vi.fn();
const recordProviderAuditEvent = vi.fn();

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("svix", () => ({ Webhook }));
vi.mock("~/db/queries/drafts", () => ({ getDraftByResendMessageId, updateDraft }));
vi.mock("~/db/queries/leads", () => ({ getLead, updateLead }));
vi.mock("~/lib/slack-notifications", () => ({ notifyBounce }));
vi.mock("~/db/queries/provider-audit", () => ({ recordProviderAuditEvent }));

function request() {
  return new Request("http://test", {
    method: "POST",
    body: "signed payload",
    headers: { "svix-id": "id", "svix-timestamp": "timestamp", "svix-signature": "signature" },
  });
}

describe("POST /api/webhooks/resend", () => {
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    verify.mockReset(); Webhook.mockClear(); getDraftByResendMessageId.mockReset(); updateDraft.mockReset();
    getLead.mockReset(); updateLead.mockReset(); notifyBounce.mockReset();
    recordProviderAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => { process.env.RESEND_WEBHOOK_SECRET = originalSecret; });

  it("rejects a request when webhook signing is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const { Route } = await import("./resend");
    const response = await (Route as any).server.handlers.POST({ request: request() });

    expect(response.status).toBe(500);
    expect(getDraftByResendMessageId).not.toHaveBeenCalled();
  });

  it("rejects an invalid webhook signature before reading campaign data", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    verify.mockImplementation(() => { throw new Error("bad signature"); });
    const { Route } = await import("./resend");
    const response = await (Route as any).server.handlers.POST({ request: request() });

    expect(response.status).toBe(401);
    expect(getDraftByResendMessageId).not.toHaveBeenCalled();
  });

  it("records a verified bounce and returns the lead to an uncontacted state", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    verify.mockReturnValue({ type: "email.bounced", created_at: "2026-01-01", data: { email_id: "email-1" } });
    getDraftByResendMessageId.mockResolvedValue({ id: "draft-1", leadId: "lead-1", openedAt: null });
    getLead.mockResolvedValue({ id: "lead-1", organizationId: "org-1", email: "sam@acme.test", ceo: "Sam", company: "Acme", status: "email_sent" });
    const { Route } = await import("./resend");
    const response = await (Route as any).server.handlers.POST({ request: request() });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith("draft-1", expect.objectContaining({ bouncedAt: expect.any(String) }));
    expect(updateLead).toHaveBeenCalledWith("lead-1", { status: "not_contacted" });
    expect(notifyBounce).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1" }));
    expect(recordProviderAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "email.bounced", outcome: "received" }));
  });
});
