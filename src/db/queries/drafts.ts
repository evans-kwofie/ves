import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export type DraftStatus =
  | "pending"
  | "approved"
  | "skipped"
  | "sent"
  | "scheduled"
  | "sending"
  | "generating"
  | "failed";

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
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  deliveredAt: string | null;
  abVariant: "a" | "b";
  generationContext: Record<string, unknown>;
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
    openedAt: (row.opened_at as string | null) ?? null,
    clickedAt: (row.clicked_at as string | null) ?? null,
    bouncedAt: (row.bounced_at as string | null) ?? null,
    deliveredAt: (row.delivered_at as string | null) ?? null,
    abVariant: (row.ab_variant as string) === "b" ? "b" : "a",
    generationContext: typeof row.generation_context === "string" ? JSON.parse(row.generation_context) as Record<string, unknown> : (row.generation_context as Record<string, unknown>) ?? {},
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
  if (opts?.stepNumber || opts?.stepNumber !== undefined) {
    conditions.push("step_number = ?");
    args.push(opts.stepNumber);
  }
  if (opts?.status || opts?.status !== undefined) {
    conditions.push("status = ?");
    args.push(opts.status);
  }
  const result = await db.execute({
    sql: `SELECT * FROM campaign_drafts WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`,
    args,
  });
  return result.rows.map((r) => rowToDraft(r as Record<string, unknown>));
}

export async function getDueCampaignSteps(): Promise<
  { campaignId: string; stepNumber: number }[]
> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `SELECT DISTINCT campaign_id, step_number FROM campaign_drafts
          WHERE status = 'scheduled' AND (send_after IS NULL OR send_after <= ?)
          AND step_number IS NOT NULL`,
    args: [now],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      campaignId: row.campaign_id as string,
      stepNumber: row.step_number as number,
    };
  });
}

/** Atomically claims due scheduled drafts so overlapping cron workers cannot generate them twice. */
export async function claimDueScheduledDrafts(campaignId: string, stepNumber: number): Promise<CampaignDraft[]> {
  const now = new Date().toISOString();
  const result = await db.execute({ sql: `UPDATE campaign_drafts SET status = 'generating', updated_at = ?
    WHERE campaign_id = ? AND step_number = ? AND status = 'scheduled' AND (send_after IS NULL OR send_after <= ?)
    RETURNING *`, args: [now, campaignId, stepNumber, now] });
  return result.rows.map((row) => rowToDraft(row as Record<string, unknown>));
}

export async function releaseDraftGenerationClaim(id: string): Promise<void> {
  await db.execute({ sql: "UPDATE campaign_drafts SET status = 'scheduled', updated_at = ? WHERE id = ? AND status = 'generating'", args: [new Date().toISOString(), id] });
}

export async function recoverStaleDraftGenerationClaims(leaseMs = 10 * 60_000): Promise<number> {
  const staleBefore = new Date(Date.now() - leaseMs).toISOString();
  const result = await db.execute({ sql: "UPDATE campaign_drafts SET status = 'scheduled', updated_at = ? WHERE status = 'generating' AND updated_at < ? RETURNING id", args: [new Date().toISOString(), staleBefore] });
  return result.rows.length;
}

export async function getDraftByResendMessageId(
  messageId: string,
): Promise<CampaignDraft | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_drafts WHERE resend_message_id = ? LIMIT 1",
    args: [messageId],
  });
  if (result.rows.length === 0) return null;
  return rowToDraft(result.rows[0] as Record<string, unknown>);
}

export async function getDraft(id: string): Promise<CampaignDraft | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_drafts WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToDraft(result.rows[0] as Record<string, unknown>);
}

export async function getLatestDraftBeforeStep(campaignId: string, leadId: string, stepNumber: number): Promise<CampaignDraft | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_drafts WHERE campaign_id = ? AND lead_id = ? AND step_number < ? ORDER BY step_number DESC LIMIT 1",
    args: [campaignId, leadId, stepNumber],
  });
  return result.rows[0] ? rowToDraft(result.rows[0] as Record<string, unknown>) : null;
}

export async function upsertDraft(input: {
  campaignId: string;
  leadId: string;
  stepNumber: number;
  channel: string;
  subject: string | null;
  body: string;
  abVariant?: "a" | "b";
  generationContext?: Record<string, unknown>;
}): Promise<CampaignDraft> {
  const now = new Date().toISOString();
  const variant = input.abVariant ?? "a";

  const existing = await db.execute({
    sql: "SELECT id FROM campaign_drafts WHERE campaign_id = ? AND lead_id = ? AND step_number = ?",
    args: [input.campaignId, input.leadId, input.stepNumber],
  });

  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as Record<string, unknown>).id as string;
    await db.execute({
      sql: "UPDATE campaign_drafts SET subject = ?, body = ?, ab_variant = ?, status = 'pending', updated_at = ? WHERE id = ?",
      args: [input.subject, input.body, variant, now, id],
    });
    return (await getDraft(id))!;
  }

  const id = uuidv4();
  await db.execute({
    sql: `INSERT INTO campaign_drafts (id, campaign_id, lead_id, channel, subject, body, status, step_number, ab_variant, generation_context, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.campaignId,
      input.leadId,
      input.channel,
      input.subject,
      input.body,
      input.stepNumber,
      variant,
      JSON.stringify(input.generationContext ?? {}),
      now,
      now,
    ],
  });
  return (await getDraft(id))!;
}

export async function updateDraft(
  id: string,
  updates: {
    subject?: string;
    body?: string;
    status?: DraftStatus;
    sentAt?: string;
    sendAfter?: string;
    stepNumber?: number;
    resendMessageId?: string;
    openedAt?: string;
    clickedAt?: string;
    bouncedAt?: string;
    deliveredAt?: string;
  },
): Promise<CampaignDraft> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string | null)[] = [now];

  if (updates.subject !== undefined) {
    fields.push("subject = ?");
    args.push(updates.subject);
  }
  if (updates.body !== undefined) {
    fields.push("body = ?");
    args.push(updates.body);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    args.push(updates.status);
  }
  if (updates.sentAt !== undefined) {
    fields.push("sent_at = ?");
    args.push(updates.sentAt);
  }
  if (updates.sendAfter !== undefined) {
    fields.push("send_after = ?");
    args.push(updates.sendAfter);
  }
  if (updates.stepNumber !== undefined) {
    fields.push("step_number = ?");
    args.push(String(updates.stepNumber));
  }
  if (updates.resendMessageId !== undefined) {
    fields.push("resend_message_id = ?");
    args.push(updates.resendMessageId);
  }
  if (updates.openedAt !== undefined) {
    fields.push("opened_at = ?");
    args.push(updates.openedAt);
  }
  if (updates.clickedAt !== undefined) {
    fields.push("clicked_at = ?");
    args.push(updates.clickedAt);
  }
  if (updates.bouncedAt !== undefined) {
    fields.push("bounced_at = ?");
    args.push(updates.bouncedAt);
  }
  if (updates.deliveredAt !== undefined) { fields.push("delivered_at = ?"); args.push(updates.deliveredAt); }

  args.push(id);
  await db.execute({
    sql: `UPDATE campaign_drafts SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  return (await getDraft(id))!;
}

export async function getDailySendCount(orgId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = await db.execute({
    sql: `SELECT COUNT(*)::int AS count
          FROM campaign_drafts cd
          JOIN campaigns c ON c.id = cd.campaign_id
          WHERE c.organization_id = ? AND cd.status = 'sent' AND cd.sent_at >= ?`,
    args: [orgId, todayStart.toISOString()],
  });
  return Number((result.rows[0] as Record<string, unknown>).count ?? 0);
}

export async function getCampaignDailySendCount(campaignId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const result = await db.execute({ sql: "SELECT COUNT(*)::int AS count FROM campaign_drafts WHERE campaign_id = ? AND status = 'sent' AND sent_at >= ?", args: [campaignId, todayStart.toISOString()] });
  return Number((result.rows[0] as Record<string, unknown>).count ?? 0);
}

export async function getCampaignChannelDailySendCount(campaignId: string, channel: string): Promise<number> {
  const result = await db.execute({ sql: `SELECT COUNT(*)::int AS count FROM campaign_drafts
    WHERE campaign_id = ? AND channel = ? AND status = 'sent' AND sent_at >= CURRENT_DATE::text`, args: [campaignId, channel] });
  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

export async function scheduleDraftForNextStep(input: {
  campaignId: string;
  leadId: string;
  nextStepNumber: number;
  channel: string;
  sendAfter: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO campaign_drafts
            (id, campaign_id, lead_id, channel, subject, body, status, send_after, step_number, ab_variant, generation_context, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, '', 'scheduled', ?, ?, 'a', '{}', ?, ?)
          ON CONFLICT (campaign_id, lead_id, step_number) DO UPDATE
          SET channel = EXCLUDED.channel,
              status = 'scheduled',
              send_after = EXCLUDED.send_after,
              subject = NULL,
              body = '',
              updated_at = EXCLUDED.updated_at
          WHERE campaign_drafts.status = 'scheduled'`,
    args: [
      uuidv4(),
      input.campaignId,
      input.leadId,
      input.channel,
      input.sendAfter,
      input.nextStepNumber,
      now,
      now,
    ],
  });
}

/** Stops any future campaign steps once a prospect replies on any channel. */
export async function skipScheduledDraftsForLead(leadId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE campaign_drafts
          SET status = 'skipped', updated_at = ?
          WHERE lead_id = ? AND status = 'scheduled'`,
    args: [new Date().toISOString(), leadId],
  });
}

export async function getPendingDraftCount(
  campaignId: string,
): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*)::int as count FROM campaign_drafts WHERE campaign_id = ? AND status = 'pending'",
    args: [campaignId],
  });
  return (result.rows[0] as Record<string, unknown>).count as number;
}

export async function deleteDraftsForCampaign(
  campaignId: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM campaign_drafts WHERE campaign_id = ? AND status = 'pending'",
    args: [campaignId],
  });
}
