import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
const updateLead = vi.fn();
const getLead = vi.fn();
const recordProviderAuditEvent = vi.fn();

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("~/agent/tools/email", () => ({ sendEmail }));
vi.mock("~/db/queries/leads", () => ({ getLead, updateLead }));
vi.mock("~/db/queries/provider-audit", () => ({ recordProviderAuditEvent }));

describe("POST /api/email/send", () => {
  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue({ success: true, messageId: "email-1" });
    updateLead.mockReset().mockResolvedValue(undefined);
    getLead.mockReset().mockResolvedValue({ emailVerificationStatus: "verified" });
    recordProviderAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("sends a valid email and records the lead send state", async () => {
    const { Route } = await import("./send");
    const handler = (Route as any).server.handlers.POST;

    const response = await handler({ request: new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "sam@acme.test", subject: "Hello", body: "A personal note", leadId: "lead-1" }),
      headers: { "Content-Type": "application/json" },
    }) });

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith({ to: "sam@acme.test", subject: "Hello", body: "A personal note" });
    expect(updateLead).toHaveBeenCalledWith("lead-1", expect.objectContaining({ status: "email_sent" }));
    expect(recordProviderAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ outcome: "succeeded", providerMessageId: "email-1" }));
  });
});
