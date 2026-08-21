import type { CampaignChannel } from "~/types/campaign";

export interface ChannelSendRule { maxPerDay?: number; windowStart?: number; windowEnd?: number; weekdaysOnly?: boolean; }

export function channelRule(rules: Record<string, unknown>, channel: CampaignChannel): ChannelSendRule {
  const raw = rules[channel];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  return {
    maxPerDay: typeof value.maxPerDay === "number" ? value.maxPerDay : undefined,
    windowStart: typeof value.windowStart === "number" ? value.windowStart : undefined,
    windowEnd: typeof value.windowEnd === "number" ? value.windowEnd : undefined,
    weekdaysOnly: typeof value.weekdaysOnly === "boolean" ? value.weekdaysOnly : undefined,
  };
}

export function checkSendWindow(input: { timezone: string; now?: Date; windowStart: number; windowEnd: number; weekdaysOnly: boolean }) {
  const now = input.now ?? new Date();
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-US", { timeZone: input.timezone, hour: "numeric", weekday: "short", hourCycle: "h23" }).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", weekday: "short", hourCycle: "h23" }).formatToParts(now); }
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  if (input.weekdaysOnly && (weekday === "Sat" || weekday === "Sun")) return "weekdays_only" as const;
  return hour < input.windowStart || hour >= input.windowEnd ? "outside_window" as const : null;
}
