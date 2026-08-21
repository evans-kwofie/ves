import { describe, expect, it } from "vitest";
import { normalizeIndustry } from "./industry";
describe("normalizeIndustry", () => {
  it("maps broad model labels without rejecting the extraction", () => {
    expect(normalizeIndustry("B2B SaaS and AI")).toBe("SaaS");
    expect(normalizeIndustry("unknown vertical")).toBeNull();
  });
});
