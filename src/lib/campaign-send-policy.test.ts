import { describe, expect, it } from "vitest";
import { channelRule, checkSendWindow } from "./campaign-send-policy";
describe("campaign send policy", () => {
  it("uses channel overrides without changing other channels", () => expect(channelRule({ linkedin: { maxPerDay: 8, weekdaysOnly: false } }, "linkedin")).toEqual({ maxPerDay: 8, weekdaysOnly: false, windowStart: undefined, windowEnd: undefined }));
  it("blocks weekends in the campaign timezone", () => expect(checkSendWindow({ timezone: "UTC", now: new Date("2026-08-22T10:00:00Z"), windowStart: 8, windowEnd: 18, weekdaysOnly: true })).toBe("weekdays_only"));
});
