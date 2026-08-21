import type { Lead } from "~/types/lead";

export type LeadPriorityQueue = "highest_fit" | "stale" | "verification_needed";

const STALE_AFTER_MS = 30 * 86_400_000;

export function isLeadStale(lead: Lead, now = Date.now()): boolean {
  const observedAt = lead.lastVerifiedAt ?? lead.enrichedAt ?? lead.addedAt;
  const timestamp = Date.parse(observedAt);
  return Number.isNaN(timestamp) || now - timestamp >= STALE_AFTER_MS;
}

export function needsLeadVerification(lead: Lead): boolean {
  return lead.isValid !== true
    || !lead.email
    || lead.emailVerificationStatus === "not_found"
    || lead.emailVerificationStatus === "accept_all";
}

export function filterPriorityQueue(leads: Lead[], queue: LeadPriorityQueue, now = Date.now()): Lead[] {
  const selected = leads.filter((lead) => {
    if (queue === "highest_fit") return lead.fit === "HIGH" && lead.status === "not_contacted" && !lead.optedOutAt;
    if (queue === "stale") return isLeadStale(lead, now);
    return needsLeadVerification(lead);
  });
  return selected.sort((a, b) => {
    if (queue === "highest_fit") return (b.score ?? 0) - (a.score ?? 0);
    if (queue === "stale") return Date.parse(a.lastVerifiedAt ?? a.enrichedAt ?? a.addedAt) - Date.parse(b.lastVerifiedAt ?? b.enrichedAt ?? b.addedAt);
    return (b.score ?? 0) - (a.score ?? 0);
  });
}
