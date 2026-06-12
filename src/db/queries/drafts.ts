import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export type DraftStatus = "pending" | "approved" | "skipped" | "sent" | "scheduled";

export interface CampaignDraft {
  id: string;
  campaignId: string;
  leadId: string;
  channel: string;
  subject: string | null;
  body: string;
  status: DraftStatus;
  sentAt: string | null;
  sendAfter: string | null;
  stepNumber: number | null;
  resendMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToDraft(row: Record<string, unknown>): CampaignDraft {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    leadId: row.lead_id as string,
    channel: (row.channel as string) ?? "email",
    subject: (row.subject as string | null) ?? null,
    body: row.body as string,
    status: (row.status as DraftStatus) ?? "pending",
    sentAt: (row.sent_at as string | null) ?? null,
    sendAfter: (row.send_after as string | null) ?? null,
    stepNumber: (row.step_number as number | null) ?? null,
    resendMessageId: (row.resend_message_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listDrafts(
  campaignId: string,
  opts?: { stepNumber?: number; status?: DraftStatus },
): Promise<CampaignDraft[]> {
  const conditions = ["campaign_id = ?"];
  const args: unknown[] = [campaignId];
  if (opts?.stepNumber !== undefined) { conditions.push("step_number = ?"); args.push(opts.stepNumber); }
  if (opts?.status !== undefined) { conditions.push("status = ?"); args.push(opts.status); }
  const result = await db.execute({
    sql: `SELECT * FROM campaign_drafts WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`,
    args,
  });
  return result.rows.map((r) => rowToDraft(r as Record<string, unknown>));
}

export async function getDueCampaignSteps(): Promise<{ campaignId: string; stepNumber: number }[]> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `SELECT DISTINCT campaign_id, step_number FROM campaign_drafts
          WHERE status = 'scheduled' AND (send_after IS NULL OR send_after <= ?)
          AND step_number IS NOT NULL`,
    args: [now],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return { campaignId: row.campaign_id as string, stepNumber: row.step_number as number };
  });
}

export async function getDraft(id: string): Promise<CampaignDraft | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_drafts WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToDraft(result.rows[0] as Record<string, unknown>);
}

export async function upsertDraft(input: {
  campaignId: string;
  leadId: string;
  stepNumber?: number;
  channel: string;
  subject: string | null;
  body: string;
}): Promise<CampaignDraft> {
  const now = new Date().toISOString();

  // Check if draft already exists for this lead+campaign
  const existing = await db.execute({
    sql: "SELECT id FROM campaign_drafts WHERE campaign_id = ? AND lead_id = ?",
    args: [input.campaignId, input.leadId],
  });

  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as Record<string, unknown>).id as string;
    await db.execute({
      sql: "UPDATE campaign_drafts SET subject = ?, body = ?, status = 'pending', updated_at = ? WHERE id = ?",
      args: [input.subject, input.body, now, id],
    });
    return (await getDraft(id))!;
  }

  const id = uuidv4();
  await db.execute({
    sql: `INSERT INTO campaign_drafts (id, campaign_id, lead_id, channel, subject, body, status, step_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    args: [id, input.campaignId, input.leadId, input.channel, input.subject, input.body, input.stepNumber ?? null, now, now],
  });
  return (await getDraft(id))!;
}

export async function updateDraft(
  id: string,
  updates: { subject?: string; body?: string; status?: DraftStatus; sentAt?: string; sendAfter?: string; stepNumber?: number; resendMessageId?: string },
): Promise<CampaignDraft> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string | null)[] = [now];

  if (updates.subject !== undefined) { fields.push("subject = ?"); args.push(updates.subject); }
  if (updates.body !== undefined) { fields.push("body = ?"); args.push(updates.body); }
  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.sentAt !== undefined) { fields.push("sent_at = ?"); args.push(updates.sentAt); }
  if (updates.sendAfter !== undefined) { fields.push("send_after = ?"); args.push(updates.sendAfter); }
  if (updates.stepNumber !== undefined) { fields.push("step_number = ?"); args.push(String(updates.stepNumber)); }
  if (updates.resendMessageId !== undefined) { fields.push("resend_message_id = ?"); args.push(updates.resendMessageId); }

  args.push(id);
  await db.execute({ sql: `UPDATE campaign_drafts SET ${fields.join(", ")} WHERE id = ?`, args });
  return (await getDraft(id))!;
}

export async function getPendingDraftCount(campaignId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*)::int as count FROM campaign_drafts WHERE campaign_id = ? AND status = 'pending'",
    args: [campaignId],
  });
  return (result.rows[0] as Record<string, unknown>).count as number;
}

export async function deleteDraftsForCampaign(campaignId: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM campaign_drafts WHERE campaign_id = ? AND status = 'pending'",
    args: [campaignId],
  });
}
