import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { Lead, Pipeline, PipelineMeta, CreateLeadInput, UpdateLeadInput, FitRating, LeadStatus } from "~/types/lead";

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    company: row.company as string,
    website: row.website as string,
    whatTheyDo: row.what_they_do as string,
    ceo: row.ceo as string,
    email: row.email as string,
    linkedin: row.linkedin as string,
    fit: row.fit as FitRating,
    status: row.status as LeadStatus,
    emailSentAt: (row.email_sent_at as string | null) ?? null,
    linkedinSentAt: (row.linkedin_sent_at as string | null) ?? null,
    repliedAt: (row.replied_at as string | null) ?? null,
    notes: row.notes as string,
    addedAt: row.added_at as string,
  };
}

function rowToMeta(row: Record<string, unknown>): PipelineMeta {
  return {
    weeklyTarget: row.weekly_target as number,
    totalEmailsSent: row.total_emails_sent as number,
    totalReplies: row.total_replies as number,
    lastRun: (row.last_run as string | null) ?? null,
  };
}

export async function listLeads(): Promise<Lead[]> {
  const result = await db.execute("SELECT * FROM leads ORDER BY added_at DESC");
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
  return rowToMeta(result.rows[0] as Record<string, unknown>);
}

export async function getPipeline(): Promise<Pipeline> {
  const [leads, meta] = await Promise.all([listLeads(), getPipelineMeta()]);
  return { leads, meta };
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const existing = await db.execute({
    sql: "SELECT id FROM leads WHERE LOWER(email) = LOWER(?)",
    args: [input.email],
  });
  if (existing.rows.length > 0) {
    throw new Error(`Lead with email ${input.email} already exists`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO leads (id, company, website, what_they_do, ceo, email, linkedin, fit, status, notes, added_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_contacted', ?, ?)`,
    args: [
      id,
      input.company,
      input.website ?? "",
      input.whatTheyDo ?? "",
      input.ceo,
      input.email,
      input.linkedin ?? "",
      input.fit,
      input.notes ?? "",
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

  if (updates.status !== undefined) {
    fields.push("status = ?");
    args.push(updates.status);
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    args.push(updates.notes);
  }
  if (updates.emailSentAt !== undefined) {
    fields.push("email_sent_at = ?");
    args.push(updates.emailSentAt);
  }
  if (updates.linkedinSentAt !== undefined) {
    fields.push("linkedin_sent_at = ?");
    args.push(updates.linkedinSentAt);
  }
  if (updates.repliedAt !== undefined) {
    fields.push("replied_at = ?");
    args.push(updates.repliedAt);
  }

  if (fields.length > 0) {
    await db.execute({
      sql: `UPDATE leads SET ${fields.join(", ")} WHERE id = ?`,
      args: [...args, id],
    });
  }

  // Update counters
  if (updates.status === "email_sent" && !lead.emailSentAt) {
    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE leads SET email_sent_at = ? WHERE id = ? AND email_sent_at IS NULL",
      args: [now, id],
    });
    await db.execute({
      sql: "UPDATE pipeline_meta SET total_emails_sent = total_emails_sent + 1, last_run = ? WHERE id = 1",
      args: [now],
    });
  }
  if (updates.status === "replied" && !lead.repliedAt) {
    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE leads SET replied_at = ? WHERE id = ? AND replied_at IS NULL",
      args: [now, id],
    });
    await db.execute({
      sql: "UPDATE pipeline_meta SET total_replies = total_replies + 1, last_run = ? WHERE id = 1",
      args: [now],
    });
  }

  return (await getLead(id))!;
}

export async function getPipelineSummary(): Promise<string> {
  const { leads, meta } = await getPipeline();
  const lines = leads.map((l) => {
    const daysSinceEmail = l.emailSentAt
      ? Math.floor((Date.now() - new Date(l.emailSentAt).getTime()) / 86400000)
      : null;
    return `id:${l.id} | ${l.company} (${l.ceo}) | ${l.email} | fit:${l.fit} | status:${l.status}${daysSinceEmail !== null ? ` | email_sent_${daysSinceEmail}d_ago` : ""}${l.notes ? ` | notes:${l.notes.slice(0, 60)}` : ""}`;
  });
  return [
    `Total leads: ${leads.length} | Emails sent: ${meta.totalEmailsSent} | Replies: ${meta.totalReplies} | Target: ${meta.weeklyTarget}`,
    ...lines,
  ].join("\n");
}

export async function getDashboardStats(): Promise<{
  totalLeads: number;
  notContacted: number;
  emailed: number;
  replied: number;
  converted: number;
  totalEmailsSent: number;
}> {
  const [leads, meta] = await Promise.all([listLeads(), getPipelineMeta()]);
  return {
    totalLeads: leads.length,
    notContacted: leads.filter((l) => l.status === "not_contacted").length,
    emailed: leads.filter((l) => l.status === "email_sent").length,
    replied: leads.filter((l) => l.status === "replied").length,
    converted: leads.filter((l) => l.status === "converted").length,
    totalEmailsSent: meta.totalEmailsSent,
  };
}
