import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export type LinkedInType = "dm" | "connect";

export interface CampaignStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  channel: string;
  linkedinType: LinkedInType | null;
  context: string | null;
  templateId: string | null;
  createdAt: string;
}

function rowToStep(row: Record<string, unknown>): CampaignStep {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    stepNumber: row.step_number as number,
    delayDays: row.delay_days as number,
    channel: (row.channel as string) ?? "email",
    linkedinType: (row.linkedin_type as LinkedInType | null) ?? null,
    context: (row.context as string | null) ?? null,
    templateId: (row.template_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listSteps(campaignId: string): Promise<CampaignStep[]> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_number ASC",
    args: [campaignId],
  });
  return result.rows.map((r) => rowToStep(r as Record<string, unknown>));
}

export async function getStep(id: string): Promise<CampaignStep | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_steps WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToStep(result.rows[0] as Record<string, unknown>);
}

export async function createStep(input: {
  campaignId: string;
  stepNumber: number;
  delayDays: number;
  channel: string;
  linkedinType?: LinkedInType | null;
  context?: string | null;
}): Promise<CampaignStep> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO campaign_steps (id, campaign_id, step_number, delay_days, channel, linkedin_type, context, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.campaignId,
      input.stepNumber,
      input.delayDays,
      input.channel,
      input.linkedinType ?? null,
      input.context ?? null,
      now,
    ],
  });
  return (await getStep(id))!;
}

export async function updateStep(
  id: string,
  updates: {
    delayDays?: number;
    channel?: string;
    linkedinType?: LinkedInType | null;
    context?: string | null;
    templateId?: string | null;
  },
): Promise<CampaignStep> {
  const fields: string[] = [];
  const args: unknown[] = [];
  if (updates.delayDays !== undefined) {
    fields.push("delay_days = ?");
    args.push(updates.delayDays);
  }
  if (updates.channel !== undefined) {
    fields.push("channel = ?");
    args.push(updates.channel);
  }
  if ("linkedinType" in updates) {
    fields.push("linkedin_type = ?");
    args.push(updates.linkedinType ?? null);
  }
  if ("context" in updates) {
    fields.push("context = ?");
    args.push(updates.context ?? null);
  }
  if ("templateId" in updates) {
    fields.push("template_id = ?");
    args.push(updates.templateId ?? null);
  }
  if (fields.length === 0) {
    const existing = await getStep(id);
    if (!existing) throw new Error(`Step ${id} not found`);
    return existing;
  }
  args.push(id);
  await db.execute({
    sql: `UPDATE campaign_steps SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  const updated = await getStep(id);
  if (!updated) throw new Error(`Step ${id} not found after update`);
  return updated;
}

export async function deleteStep(id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM campaign_steps WHERE id = ?",
    args: [id],
  });
}

export async function getNextStep(
  campaignId: string,
  currentStepNumber: number,
): Promise<CampaignStep | null> {
  const result = await db.execute({
    sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number > ? ORDER BY step_number ASC LIMIT 1",
    args: [campaignId, currentStepNumber],
  });
  if (result.rows.length === 0) return null;
  return rowToStep(result.rows[0] as Record<string, unknown>);
}

export async function ensureDefaultStep(
  campaignId: string,
  channel: string,
): Promise<CampaignStep> {
  const existing = await listSteps(campaignId);
  if (existing.length > 0) return existing[0];
  return createStep({
    campaignId,
    stepNumber: 1,
    delayDays: 0,
    channel,
    context: null,
  });
}
