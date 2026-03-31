import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { Campaign, CreateCampaignInput, UpdateCampaignInput } from "~/types/campaign";
import type { Lead } from "~/types/lead";

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    status: row.status as Campaign["status"],
    channel: (row.channel as Campaign["channel"]) ?? null,
    goal: (row.goal as string | null) ?? null,
    runFrequency: (row.run_frequency as Campaign["runFrequency"]) ?? null,
    lastRunAt: (row.last_run_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    leadCount: 0,
    sentCount: 0,
    replyCount: 0,
  };
}

async function attachStats(campaigns: Campaign[]): Promise<Campaign[]> {
  for (const c of campaigns) {
    const [lc, sc, rc] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) as count FROM campaign_leads WHERE campaign_id = ?", args: [c.id] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM outreach_events WHERE campaign_id = ? AND status = 'email_sent'", args: [c.id] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM outreach_events WHERE campaign_id = ? AND status = 'replied'", args: [c.id] }),
    ]);
    c.leadCount = (lc.rows[0] as Record<string, unknown>).count as number;
    c.sentCount = (sc.rows[0] as Record<string, unknown>).count as number;
    c.replyCount = (rc.rows[0] as Record<string, unknown>).count as number;
  }
  return campaigns;
}

export async function listCampaigns(orgId: string): Promise<Campaign[]> {
  const result = await db.execute({
    sql: "SELECT * FROM campaigns WHERE organization_id = ? ORDER BY created_at DESC",
    args: [orgId],
  });
  const campaigns = result.rows.map((r) => rowToCampaign(r as Record<string, unknown>));
  return attachStats(campaigns);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const result = await db.execute({ sql: "SELECT * FROM campaigns WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  const [campaign] = await attachStats([rowToCampaign(result.rows[0] as Record<string, unknown>)]);
  return campaign;
}

export async function createCampaign(orgId: string, input: CreateCampaignInput): Promise<Campaign> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO campaigns (id, organization_id, name, status, channel, goal, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, orgId, input.name, input.status ?? "draft", input.channel ?? null, input.goal ?? null, now, now],
  });

  if (input.leadIds && input.leadIds.length > 0) {
    for (const leadId of input.leadIds) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO campaign_leads (id, campaign_id, lead_id) VALUES (?, ?, ?)",
        args: [uuidv4(), id, leadId],
      });
    }
  }

  return (await getCampaign(id))!;
}

export async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string | null)[] = [now];

  if (input.name !== undefined) { fields.push("name = ?"); args.push(input.name); }
  if (input.status !== undefined) { fields.push("status = ?"); args.push(input.status); }
  if (input.channel !== undefined) { fields.push("channel = ?"); args.push(input.channel); }
  if (input.goal !== undefined) { fields.push("goal = ?"); args.push(input.goal); }
  if (input.runFrequency !== undefined) { fields.push("run_frequency = ?"); args.push(input.runFrequency ?? null); }

  args.push(id);
  await db.execute({ sql: `UPDATE campaigns SET ${fields.join(", ")} WHERE id = ?`, args });
  return (await getCampaign(id))!;
}

export async function deleteCampaign(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM campaigns WHERE id = ?", args: [id] });
}

export async function getCampaignLeadIds(campaignId: string): Promise<string[]> {
  const result = await db.execute({
    sql: "SELECT lead_id FROM campaign_leads WHERE campaign_id = ?",
    args: [campaignId],
  });
  return result.rows.map((r) => (r as Record<string, unknown>).lead_id as string);
}

export async function addLeadToCampaign(campaignId: string, leadId: string): Promise<void> {
  await db.execute({
    sql: "INSERT OR IGNORE INTO campaign_leads (id, campaign_id, lead_id) VALUES (?, ?, ?)",
    args: [uuidv4(), campaignId, leadId],
  });
}

export async function removeLeadFromCampaign(campaignId: string, leadId: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM campaign_leads WHERE campaign_id = ? AND lead_id = ?",
    args: [campaignId, leadId],
  });
}

export async function getCampaignLeadsWithData(campaignId: string): Promise<Lead[]> {
  const result = await db.execute({
    sql: `SELECT l.* FROM leads l
          INNER JOIN campaign_leads cl ON cl.lead_id = l.id
          WHERE cl.campaign_id = ?
          ORDER BY l.fit DESC, l.score DESC`,
    args: [campaignId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      company: row.company as string,
      website: row.website as string,
      whatTheyDo: row.what_they_do as string,
      ceo: row.ceo as string,
      email: (row.email as string | null) ?? "",
      linkedin: (row.linkedin_url as string | null) ?? "",
      fit: (row.fit as Lead["fit"]) ?? "MEDIUM",
      fitReason: (row.fit_reason as string | null) ?? null,
      score: (row.score as number | null) ?? null,
      status: (row.status as Lead["status"]) ?? "not_contacted",
      pipelineStage: (row.pipeline_stage as Lead["pipelineStage"]) ?? "discovered",
      enrichmentAttempts: (row.enrichment_attempts as number) ?? 0,
      source: (row.source as string | null) ?? null,
      emailSentAt: (row.email_sent_at as string | null) ?? null,
      linkedinSentAt: (row.linkedin_sent_at as string | null) ?? null,
      repliedAt: (row.replied_at as string | null) ?? null,
      notes: (row.notes as string) ?? "",
      addedAt: row.added_at as string,
    };
  });
}

export async function updateCampaignLastRun(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE campaigns SET last_run_at = ?, updated_at = ? WHERE id = ?",
    args: [now, now, id],
  });
}

export async function listCampaignsDueToRun(): Promise<Campaign[]> {
  const result = await db.execute({
    sql: "SELECT * FROM campaigns WHERE status = 'active' AND run_frequency IS NOT NULL",
    args: [],
  });
  const candidates = result.rows.map((r) => rowToCampaign(r as Record<string, unknown>));

  const now = Date.now();
  const frequencyMs: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    every_3_days: 3 * 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
  };

  return candidates.filter((c) => {
    const row = result.rows.find((r) => (r as Record<string, unknown>).id === c.id) as Record<string, unknown>;
    const lastRun = row.last_run_at as string | null;
    const freq = row.run_frequency as string;
    const interval = frequencyMs[freq];
    if (!interval) return false;
    if (!lastRun) return true;
    return now - new Date(lastRun).getTime() >= interval;
  });
}
