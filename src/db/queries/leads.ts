import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { Lead, Pipeline, PipelineMeta, CreateLeadInput, UpdateLeadInput, FitRating, LeadStatus, PipelineStage } from "~/types/lead";

export interface OutreachEvent {
  id: string;
  leadId: string;
  channel: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
}

export async function createOutreachEvent(input: {
  leadId: string;
  channel: string;
  status: string;
  sentAt?: string | null;
  repliedAt?: string | null;
  campaignId?: string | null;
}): Promise<OutreachEvent> {
  const id = uuidv4();
  await db.execute({
    sql: `INSERT INTO outreach_events (id, lead_id, channel, status, sent_at, replied_at, campaign_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.leadId, input.channel, input.status, input.sentAt ?? null, input.repliedAt ?? null, input.campaignId ?? null],
  });
  return { id, leadId: input.leadId, channel: input.channel, status: input.status, sentAt: input.sentAt ?? null, repliedAt: input.repliedAt ?? null };
}

export async function getOutreachEvents(leadId: string): Promise<OutreachEvent[]> {
  const result = await db.execute({
    sql: "SELECT * FROM outreach_events WHERE lead_id = ? ORDER BY COALESCE(sent_at, replied_at) ASC",
    args: [leadId],
  });
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      leadId: row.lead_id as string,
      channel: row.channel as string,
      status: row.status as string,
      sentAt: (row.sent_at as string | null) ?? null,
      repliedAt: (row.replied_at as string | null) ?? null,
    };
  });
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    company: row.company as string,
    website: row.website as string,
    whatTheyDo: row.what_they_do as string,
    ceo: row.ceo as string,
    email: (row.email as string | null) ?? "",
    linkedin: (row.linkedin_url as string | null) ?? "",
    fit: (row.fit as FitRating) ?? "MEDIUM",
    fitReason: (row.fit_reason as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    status: (row.status as LeadStatus) ?? "not_contacted",
    pipelineStage: (row.pipeline_stage as PipelineStage) ?? "discovered",
    enrichmentAttempts: (row.enrichment_attempts as number) ?? 0,
    source: (row.source as string | null) ?? null,
    emailSentAt: (row.email_sent_at as string | null) ?? null,
    linkedinSentAt: (row.linkedin_sent_at as string | null) ?? null,
    repliedAt: (row.replied_at as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    addedAt: row.added_at as string,
  };
}

export async function listLeads(orgId: string): Promise<Lead[]> {
  const result = await db.execute({
    sql: "SELECT * FROM leads WHERE organization_id = ? ORDER BY added_at DESC",
    args: [orgId],
  });
  return result.rows.map((r) => rowToLead(r as Record<string, unknown>));
}

export async function getLead(id: string): Promise<Lead | null> {
  const result = await db.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  return rowToLead(result.rows[0] as Record<string, unknown>);
}

export async function getPipelineMeta(): Promise<PipelineMeta> {
  const result = await db.execute("SELECT * FROM pipeline_meta WHERE id = 1");
  if (result.rows.length === 0) {
    return { weeklyTarget: 5, totalEmailsSent: 0, totalReplies: 0, lastRun: null };
  }
  const row = result.rows[0] as Record<string, unknown>;
  return {
    weeklyTarget: row.weekly_target as number,
    totalEmailsSent: row.total_emails_sent as number,
    totalReplies: row.total_replies as number,
    lastRun: (row.last_run as string | null) ?? null,
  };
}

export async function getPipeline(orgId: string): Promise<Pipeline> {
  const leads = await listLeads(orgId);
  // Derive counters from org-scoped leads rather than the global pipeline_meta row
  const meta: PipelineMeta = {
    weeklyTarget: 5,
    totalEmailsSent: leads.filter((l) => l.emailSentAt).length,
    totalReplies: leads.filter((l) => l.repliedAt).length,
    lastRun: null,
  };
  return { leads, meta };
}

export async function createLead(orgId: string, input: CreateLeadInput): Promise<Lead> {
  const existing = await db.execute({
    sql: "SELECT id FROM leads WHERE LOWER(email) = LOWER(?) AND organization_id = ?",
    args: [input.email, orgId],
  });
  if (existing.rows.length > 0) {
    throw new Error(`Lead with email ${input.email} already exists`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO leads (id, organization_id, company, website, what_they_do, ceo, email, linkedin_url, fit, status, notes, added_at, discovered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_contacted', ?, ?, ?)`,
    args: [
      id,
      orgId,
      input.company,
      input.website ?? "",
      input.whatTheyDo ?? "",
      input.ceo,
      input.email,
      input.linkedin ?? "",
      input.fit,
      input.notes ?? "",
      now,
      now,
    ],
  });

  return (await getLead(id))!;
}

export async function updateLead(id: string, updates: UpdateLeadInput): Promise<Lead> {
  const lead = await getLead(id);
  if (!lead) throw new Error(`Lead not found: ${id}`);

  const fields: string[] = [];
  const args: (string | null)[] = [];

  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.notes !== undefined) { fields.push("notes = ?"); args.push(updates.notes); }
  if (updates.emailSentAt !== undefined) { fields.push("email_sent_at = ?"); args.push(updates.emailSentAt); }
  if (updates.linkedinSentAt !== undefined) { fields.push("linkedin_sent_at = ?"); args.push(updates.linkedinSentAt); }
  if (updates.repliedAt !== undefined) { fields.push("replied_at = ?"); args.push(updates.repliedAt); }
  if (updates.pipelineStage !== undefined) { fields.push("pipeline_stage = ?"); args.push(updates.pipelineStage); }
  if (updates.enrichmentAttempts !== undefined) { fields.push("enrichment_attempts = ?"); args.push(String(updates.enrichmentAttempts)); }
  if (updates.fit !== undefined) { fields.push("fit = ?"); args.push(updates.fit); }
  if (updates.fitReason !== undefined) { fields.push("fit_reason = ?"); args.push(updates.fitReason); }
  if (updates.score !== undefined) { fields.push("score = ?"); args.push(String(updates.score)); }
  if (updates.website !== undefined) { fields.push("website = ?"); args.push(updates.website); }
  if (updates.whatTheyDo !== undefined) { fields.push("what_they_do = ?"); args.push(updates.whatTheyDo); }
  if (updates.linkedin !== undefined) { fields.push("linkedin_url = ?"); args.push(updates.linkedin); }

  if (fields.length > 0) {
    await db.execute({
      sql: `UPDATE leads SET ${fields.join(", ")} WHERE id = ?`,
      args: [...args, id],
    });
  }

  return (await getLead(id))!;
}

export async function getDashboardStats(orgId: string): Promise<{
  totalLeads: number;
  notContacted: number;
  emailed: number;
  replied: number;
  converted: number;
  totalEmailsSent: number;
}> {
  const leads = await listLeads(orgId);
  return {
    totalLeads: leads.length,
    notContacted: leads.filter((l) => l.status === "not_contacted").length,
    emailed: leads.filter((l) => l.status === "email_sent").length,
    replied: leads.filter((l) => l.status === "replied").length,
    converted: leads.filter((l) => l.status === "converted").length,
    totalEmailsSent: leads.filter((l) => l.emailSentAt).length,
  };
}

export async function getRecentLeads(orgId: string, limit = 5): Promise<Lead[]> {
  const result = await db.execute({
    sql: "SELECT * FROM leads WHERE organization_id = ? ORDER BY added_at DESC LIMIT ?",
    args: [orgId, limit],
  });
  return result.rows.map((r) => rowToLead(r as Record<string, unknown>));
}

export async function getLeadGrowth(orgId: string): Promise<{ date: string; count: number }[]> {
  // Returns lead counts grouped by day for the last 7 days
  const result = await db.execute({
    sql: `
      SELECT DATE(added_at) as date, COUNT(*) as count
      FROM leads
      WHERE organization_id = ?
        AND added_at >= DATE('now', '-6 days')
      GROUP BY DATE(added_at)
      ORDER BY date ASC
    `,
    args: [orgId],
  });
  // Fill in missing days with 0
  const map = new Map<string, number>();
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    map.set(r.date as string, Number(r.count));
  }
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ date: key, count: map.get(key) ?? 0 });
  }
  return days;
}

export async function getPipelineSummary(orgId: string): Promise<string> {
  const { leads } = await getPipeline(orgId);
  const lines = leads.map((l) => {
    const daysSinceEmail = l.emailSentAt
      ? Math.floor((Date.now() - new Date(l.emailSentAt).getTime()) / 86400000)
      : null;
    return `id:${l.id} | ${l.company} (${l.ceo}) | ${l.email} | fit:${l.fit} | status:${l.status}${daysSinceEmail !== null ? ` | email_sent_${daysSinceEmail}d_ago` : ""}${l.notes ? ` | notes:${l.notes.slice(0, 60)}` : ""}`;
  });
  return [
    `Total leads: ${leads.length} | Target: 5`,
    ...lines,
  ].join("\n");
}
