import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyEmail } from "./find-email";

const originalApiKey = process.env.HUNTER_API_KEY;

afterEach(() => {
  process.env.HUNTER_API_KEY = originalApiKey;
  vi.unstubAllGlobals();
});

describe("verifyEmail", () => {
  it("maps Hunter valid and invalid results to the lead verification states", async () => {
    process.env.HUNTER_API_KEY = "test-key";
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: "valid", score: 100 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: "invalid", score: 0 } }) });
    vi.stubGlobal("fetch", fetch);

    await expect(verifyEmail("valid@example.com")).resolves.toEqual({ status: "verified", confidence: 100 });
    await expect(verifyEmail("invalid@example.com")).resolves.toEqual({ status: "not_found", confidence: 0 });
    expect(fetch.mock.calls[0][0]).toContain("email-verifier");
  });

  it("does not block sending when verification is unavailable or unresolved", async () => {
    delete process.env.HUNTER_API_KEY;
    await expect(verifyEmail("lead@example.com")).resolves.toBeNull();
  });
});
