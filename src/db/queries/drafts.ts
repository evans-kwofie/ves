import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export type DraftStatus = "pending" | "approved" | "skipped" | "sent";

export interface CampaignDraft {
  id: string;
  campaignId: string;
  leadId: string;
  channel: string;
  subject: string | null;
  body: string;
  status: DraftStatus;
  sentAt: string | null;
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listDrafts(campaignId: string): Promise<CampaignDraft[]> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_drafts WHERE campaign_id = ? ORDER BY created_at ASC",
    args: [campaignId],
  });
  return result.rows.map((r) => rowToDraft(r as Record<string, unknown>));
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
    sql: `INSERT INTO campaign_drafts (id, campaign_id, lead_id, channel, subject, body, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [id, input.campaignId, input.leadId, input.channel, input.subject, input.body, now, now],
  });
  return (await getDraft(id))!;
}

export async function updateDraft(
  id: string,
  updates: { subject?: string; body?: string; status?: DraftStatus; sentAt?: string },
): Promise<CampaignDraft> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string | null)[] = [now];

  if (updates.subject !== undefined) { fields.push("subject = ?"); args.push(updates.subject); }
  if (updates.body !== undefined) { fields.push("body = ?"); args.push(updates.body); }
  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.sentAt !== undefined) { fields.push("sent_at = ?"); args.push(updates.sentAt); }

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
