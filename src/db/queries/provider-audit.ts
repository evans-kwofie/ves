import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export async function recordProviderAuditEvent(input: { provider: string; eventType: string; outcome: "succeeded" | "failed" | "received"; leadId?: string | null; campaignDraftId?: string | null; providerMessageId?: string | null; detail?: Record<string, unknown> }) {
  await db.execute({ sql: "INSERT INTO provider_audit_events (id, provider, event_type, outcome, lead_id, campaign_draft_id, provider_message_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [uuidv4(), input.provider, input.eventType, input.outcome, input.leadId ?? null, input.campaignDraftId ?? null, input.providerMessageId ?? null, JSON.stringify(input.detail ?? {})] });
}
