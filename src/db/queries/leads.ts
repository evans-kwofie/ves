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
  campaignId: string | null;
  campaignName: string | null;
}

export interface EnrichmentAttempt {
  id: string;
  jobId: string;
  leadId: string;
  attemptNumber: number;
  status: "succeeded" | "retrying" | "failed";
  summary: string | null;
  error: string | null;
  createdAt: string;
}

export interface EnrichmentJob {
  id: string;
  leadId: string;
  organizationId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  lastError: string | null;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === 1 || value === "1" || value === "true";
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
  return { id, leadId: input.leadId, channel: input.channel, status: input.status, sentAt: input.sentAt ?? null, repliedAt: input.repliedAt ?? null, campaignId: input.campaignId ?? null, campaignName: null };
}

export async function getOutreachEvents(leadId: string): Promise<OutreachEvent[]> {
  const result = await db.execute({
    sql: `SELECT oe.*, c.name AS campaign_name
          FROM outreach_events oe
          LEFT JOIN campaigns c ON c.id = oe.campaign_id
          WHERE oe.lead_id = ?
          ORDER BY COALESCE(oe.sent_at, oe.replied_at) ASC`,
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
      campaignId: (row.campaign_id as string | null) ?? null,
      campaignName: (row.campaign_name as string | null) ?? null,
    };
  });
}

function rowToEnrichmentJob(row: Record<string, unknown>): EnrichmentJob {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    organizationId: row.organization_id as string,
    status: row.status as EnrichmentJob["status"],
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    nextRunAt: row.next_run_at as string,
    lastError: (row.last_error as string | null) ?? null,
  };
}

export async function queueLeadEnrichment(lead: Lead): Promise<EnrichmentJob> {
  const now = new Date().toISOString();
  const existing = await db.execute({ sql: "SELECT * FROM lead_enrichment_jobs WHERE lead_id = ?", args: [lead.id] });
  if (existing.rows.length > 0) {
    const job = rowToEnrichmentJob(existing.rows[0] as Record<string, unknown>);
    if (job.status === "queued" || job.status === "running") return job;
    await db.execute({
      sql: `UPDATE lead_enrichment_jobs
            SET status = 'queued', attempts = 0, next_run_at = ?, locked_at = NULL, completed_at = NULL, last_error = NULL, updated_at = ?
            WHERE id = ?`,
      args: [now, now, job.id],
    });
    await updateLead(lead.id, { pipelineStage: "enriching", enrichmentAttempts: 0 });
    return { ...job, status: "queued", attempts: 0, nextRunAt: now, lastError: null };
  }

  const id = uuidv4();
  await db.execute({
    sql: `INSERT INTO lead_enrichment_jobs (id, lead_id, organization_id, status, attempts, max_attempts, next_run_at, created_at, updated_at)
          VALUES (?, ?, ?, 'queued', 0, 3, ?, ?, ?)`,
    args: [id, lead.id, lead.organizationId, now, now, now],
  });
  await updateLead(lead.id, { pipelineStage: "enriching", enrichmentAttempts: 0 });
  return { id, leadId: lead.id, organizationId: lead.organizationId, status: "queued", attempts: 0, maxAttempts: 3, nextRunAt: now, lastError: null };
}

/** Atomically lease one due job. The lease prevents duplicate work across server instances. */
export async function claimDueEnrichmentJob(leaseMs = 10 * 60_000): Promise<EnrichmentJob | null> {
  const now = new Date();
  const lockedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - leaseMs).toISOString();
  const result = await db.execute({
    sql: `UPDATE lead_enrichment_jobs
          SET status = 'running', attempts = attempts + 1, locked_at = ?, updated_at = ?
          WHERE id = (
            SELECT id FROM lead_enrichment_jobs
            WHERE attempts < max_attempts
              AND ((status = 'queued' AND next_run_at <= ?) OR (status = 'running' AND locked_at < ?))
            ORDER BY next_run_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING *`,
    args: [lockedAt, lockedAt, lockedAt, staleBefore],
  });
  return result.rows[0] ? rowToEnrichmentJob(result.rows[0]) : null;
}

/** Terminally recover jobs whose final leased attempt was interrupted. */
export async function failExpiredEnrichmentJobs(leaseMs = 10 * 60_000): Promise<EnrichmentJob[]> {
  const staleBefore = new Date(Date.now() - leaseMs).toISOString();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE lead_enrichment_jobs
          SET status = 'failed', last_error = 'Enrichment worker lease expired', completed_at = ?, locked_at = NULL, updated_at = ?
          WHERE status = 'running' AND attempts >= max_attempts AND locked_at < ?
          RETURNING *`,
    args: [now, now, staleBefore],
  });
  return result.rows.map((row) => rowToEnrichmentJob(row));
}

export async function updateEnrichmentJob(id: string, updates: Partial<Pick<EnrichmentJob, "status" | "attempts" | "nextRunAt" | "lastError">> & { completedAt?: string | null; lockedAt?: string | null }): Promise<void> {
  const fields = ["updated_at = ?"];
  const args: (string | number | null)[] = [new Date().toISOString()];
  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.attempts !== undefined) { fields.push("attempts = ?"); args.push(updates.attempts); }
  if (updates.nextRunAt !== undefined) { fields.push("next_run_at = ?"); args.push(updates.nextRunAt); }
  if (updates.lastError !== undefined) { fields.push("last_error = ?"); args.push(updates.lastError); }
  if (updates.completedAt !== undefined) { fields.push("completed_at = ?"); args.push(updates.completedAt); }
  if (updates.lockedAt !== undefined) { fields.push("locked_at = ?"); args.push(updates.lockedAt); }
  await db.execute({ sql: `UPDATE lead_enrichment_jobs SET ${fields.join(", ")} WHERE id = ?`, args: [...args, id] });
}

export async function createEnrichmentAttempt(input: Omit<EnrichmentAttempt, "id" | "createdAt">): Promise<void> {
  await db.execute({
    sql: `INSERT INTO lead_enrichment_attempts (id, job_id, lead_id, attempt_number, status, summary, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [uuidv4(), input.jobId, input.leadId, input.attemptNumber, input.status, input.summary, input.error, new Date().toISOString()],
  });
}

export async function getEnrichmentAttempts(leadId: string): Promise<EnrichmentAttempt[]> {
  const result = await db.execute({ sql: "SELECT * FROM lead_enrichment_attempts WHERE lead_id = ? ORDER BY created_at DESC", args: [leadId] });
  return result.rows.map((row) => {
    const value = row as Record<string, unknown>;
    return { id: value.id as string, jobId: value.job_id as string, leadId: value.lead_id as string, attemptNumber: Number(value.attempt_number), status: value.status as EnrichmentAttempt["status"], summary: (value.summary as string | null) ?? null, error: (value.error as string | null) ?? null, createdAt: value.created_at as string };
  });
}

function rowToLead(row: Record<string, unknown>): Lead {
  let validationErrors: string[] = [];
  try {
    const raw = row.validation_errors;
    validationErrors = Array.isArray(raw) ? raw as string[] : JSON.parse((raw as string | null) ?? "[]") as string[];
  } catch {
    validationErrors = [];
  }
  let sourceDetails: Record<string, unknown> = {};
  try { sourceDetails = typeof row.source_details === "string" ? JSON.parse(row.source_details) : (row.source_details as Record<string, unknown>) ?? {}; } catch { sourceDetails = {}; }
  const jsonList = (value: unknown): unknown[] => { try { return Array.isArray(value) ? value : JSON.parse((value as string | null) ?? "[]"); } catch { return []; } };
  let scoreBreakdown: Record<string, number> = {};
  try { scoreBreakdown = typeof row.score_breakdown === "string" ? JSON.parse(row.score_breakdown) : (row.score_breakdown as Record<string, number>) ?? {}; } catch { scoreBreakdown = {}; }

  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
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
    isValid: toNullableBoolean(row.is_valid),
    validationErrors,
    websiteValid: toNullableBoolean(row.website_valid),
    personValid: toNullableBoolean(row.person_valid),
    companyValid: toNullableBoolean(row.company_valid),
    validatedAt: (row.validated_at as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    sourceDetails,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
    enrichedAt: (row.enriched_at as string | null) ?? null,
    role: (row.role as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    companySize: (row.company_size as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    intentSignals: jsonList(row.intent_signals).filter((value): value is string => typeof value === "string"),
    engagementHistory: jsonList(row.engagement_history).filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null),
    scoreBreakdown,
    emailVerificationStatus: (row.email_verification_status as Lead["emailVerificationStatus"]) ?? null,
    emailVerificationConfidence: row.email_verification_confidence == null ? null : Number(row.email_verification_confidence),
    emailVerificationProvider: (row.email_verification_provider as string | null) ?? null,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    optedOutAt: (row.opted_out_at as string | null) ?? null,
    emailSentAt: (row.email_sent_at as string | null) ?? null,
    linkedinSentAt: (row.linkedin_sent_at as string | null) ?? null,
    instagramSentAt: (row.instagram_sent_at as string | null) ?? null,
    repliedAt: (row.replied_at as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    addedAt: row.added_at as string,
  };
}

export async function listLeads(orgId: string): Promise<Lead[]> {
  const result = await db.execute({
    sql: `SELECT * FROM leads WHERE organization_id = ?
          ORDER BY CASE fit WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END DESC,
                   score DESC NULLS LAST, added_at DESC`,
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
  const email = input.email?.trim().replace(/^mailto:/i, "") || null;
  if (email) {
    const existing = await db.execute({
      sql: "SELECT id FROM leads WHERE LOWER(email) = LOWER(?) AND organization_id = ?",
      args: [email, orgId],
    });
    if (existing.rows.length > 0) {
      throw new Error(`Lead with email ${email} already exists`);
    }
  }
  // A social profile URL identifies one person; a regular company website does
  // not—multiple contacts at the same company are valid distinct leads.
  const profileUrl = normalizeProfileUrl(input.linkedin) ?? (
    input.source === "instagram" || input.source === "reddit"
      ? normalizeProfileUrl(input.website)
      : null
  );
  if (profileUrl) {
    const existing = await db.execute({
      sql: `SELECT id FROM leads
            WHERE organization_id = ?
              AND (LOWER(TRIM(TRAILING '/' FROM website)) = ? OR LOWER(TRIM(TRAILING '/' FROM linkedin_url)) = ?)
            LIMIT 1`,
      args: [orgId, profileUrl, profileUrl],
    });
    if (existing.rows.length > 0) {
      throw new Error("Lead with this social profile already exists");
    }
  }
  if (input.ceo?.trim()) {
    const existing = await db.execute({
      sql: `SELECT id FROM leads
            WHERE LOWER(company) = LOWER(?) AND LOWER(ceo) = LOWER(?) AND organization_id = ?`,
      args: [input.company.trim(), input.ceo.trim(), orgId],
    });
    if (existing.rows.length > 0) {
      throw new Error(`Lead for ${input.ceo} at ${input.company} already exists`);
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO leads (id, organization_id, company, website, what_they_do, ceo, email, linkedin_url, fit, status, notes, source, source_details, role, industry, company_size, location, intent_signals, engagement_history, score_breakdown, added_at, discovered_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_contacted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      orgId,
      input.company,
      input.website ?? "",
      input.whatTheyDo ?? "",
      input.ceo?.trim() ?? "",
      email,
      input.linkedin ?? "",
      input.fit,
      input.notes ?? "",
      input.source ?? null,
      JSON.stringify(input.sourceDetails ?? {}),
      input.role ?? null, input.industry ?? null, input.companySize ?? null, input.location ?? null,
      JSON.stringify(input.intentSignals ?? []), JSON.stringify(input.engagementHistory ?? []),
      JSON.stringify(input.scoreBreakdown ?? {}),
      now,
      now,
    ],
  });

  const lead = (await getLead(id))!;
  // Every ingestion path uses createLead, so queue enrichment here instead of
  // relying on each source route to remember a separate follow-up call.
  await queueLeadEnrichment(lead);
  return (await getLead(id))!;
}

function normalizeProfileUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.search = "";
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/+$/, "").toLowerCase();
  }
}

export async function updateLead(id: string, updates: UpdateLeadInput): Promise<Lead> {
  const lead = await getLead(id);
  if (!lead) throw new Error(`Lead not found: ${id}`);

  if (updates.email !== undefined && updates.email?.trim()) {
    const normalizedEmail = updates.email.trim().replace(/^mailto:/i, "");
    const existing = await db.execute({
      sql: "SELECT id FROM leads WHERE organization_id = ? AND LOWER(BTRIM(email)) = LOWER(BTRIM(?)) AND id <> ? LIMIT 1",
      args: [lead.organizationId, normalizedEmail, id],
    });
    if (existing.rows.length > 0) throw new Error(`Lead with email ${normalizedEmail} already exists`);
    updates = { ...updates, email: normalizedEmail };
  }

  const fields: string[] = ["updated_at = ?"];
  const args: (string | null)[] = [new Date().toISOString()];

  if (updates.company !== undefined) { fields.push("company = ?"); args.push(updates.company); }
  if (updates.ceo !== undefined) { fields.push("ceo = ?"); args.push(updates.ceo); }
  if (updates.email !== undefined) { fields.push("email = ?"); args.push(updates.email); }
  if (updates.status !== undefined) { fields.push("status = ?"); args.push(updates.status); }
  if (updates.notes !== undefined) { fields.push("notes = ?"); args.push(updates.notes); }
  if (updates.emailSentAt !== undefined) { fields.push("email_sent_at = ?"); args.push(updates.emailSentAt); }
  if (updates.linkedinSentAt !== undefined) { fields.push("linkedin_sent_at = ?"); args.push(updates.linkedinSentAt); }
  if (updates.instagramSentAt !== undefined) { fields.push("instagram_sent_at = ?"); args.push(updates.instagramSentAt); }
  if (updates.repliedAt !== undefined) { fields.push("replied_at = ?"); args.push(updates.repliedAt); }
  if (updates.pipelineStage !== undefined) { fields.push("pipeline_stage = ?"); args.push(updates.pipelineStage); }
  if (updates.enrichmentAttempts !== undefined) { fields.push("enrichment_attempts = ?"); args.push(String(updates.enrichmentAttempts)); }
  if (updates.fit !== undefined) { fields.push("fit = ?"); args.push(updates.fit); }
  if (updates.fitReason !== undefined) { fields.push("fit_reason = ?"); args.push(updates.fitReason); }
  if (updates.score !== undefined) { fields.push("score = ?"); args.push(updates.score === null ? null : String(updates.score)); }
  if (updates.website !== undefined) { fields.push("website = ?"); args.push(updates.website); }
  if (updates.whatTheyDo !== undefined) { fields.push("what_they_do = ?"); args.push(updates.whatTheyDo); }
  if (updates.linkedin !== undefined) { fields.push("linkedin_url = ?"); args.push(updates.linkedin); }
  if (updates.isValid !== undefined) { fields.push("is_valid = ?"); args.push(updates.isValid === null ? null : String(updates.isValid)); }
  if (updates.validationErrors !== undefined) { fields.push("validation_errors = ?"); args.push(JSON.stringify(updates.validationErrors)); }
  if (updates.websiteValid !== undefined) { fields.push("website_valid = ?"); args.push(updates.websiteValid === null ? null : String(updates.websiteValid)); }
  if (updates.personValid !== undefined) { fields.push("person_valid = ?"); args.push(updates.personValid === null ? null : String(updates.personValid)); }
  if (updates.companyValid !== undefined) { fields.push("company_valid = ?"); args.push(updates.companyValid === null ? null : String(updates.companyValid)); }
  if (updates.validatedAt !== undefined) { fields.push("validated_at = ?"); args.push(updates.validatedAt); }
  if (updates.sourceDetails !== undefined) { fields.push("source_details = ?"); args.push(JSON.stringify(updates.sourceDetails)); }
  if (updates.lastVerifiedAt !== undefined) { fields.push("last_verified_at = ?"); args.push(updates.lastVerifiedAt); }
  if (updates.enrichedAt !== undefined) { fields.push("enriched_at = ?"); args.push(updates.enrichedAt); }
  if (updates.role !== undefined) { fields.push("role = ?"); args.push(updates.role); }
  if (updates.industry !== undefined) { fields.push("industry = ?"); args.push(updates.industry); }
  if (updates.companySize !== undefined) { fields.push("company_size = ?"); args.push(updates.companySize); }
  if (updates.location !== undefined) { fields.push("location = ?"); args.push(updates.location); }
  if (updates.intentSignals !== undefined) { fields.push("intent_signals = ?"); args.push(JSON.stringify(updates.intentSignals)); }
  if (updates.engagementHistory !== undefined) { fields.push("engagement_history = ?"); args.push(JSON.stringify(updates.engagementHistory)); }
  if (updates.scoreBreakdown !== undefined) { fields.push("score_breakdown = ?"); args.push(JSON.stringify(updates.scoreBreakdown)); }
  if (updates.emailVerificationStatus !== undefined) { fields.push("email_verification_status = ?"); args.push(updates.emailVerificationStatus); }
  if (updates.emailVerificationConfidence !== undefined) { fields.push("email_verification_confidence = ?"); args.push(updates.emailVerificationConfidence === null ? null : String(updates.emailVerificationConfidence)); }
  if (updates.emailVerificationProvider !== undefined) { fields.push("email_verification_provider = ?"); args.push(updates.emailVerificationProvider); }
  if (updates.emailVerifiedAt !== undefined) { fields.push("email_verified_at = ?"); args.push(updates.emailVerifiedAt); }
  if (updates.optedOutAt !== undefined) { fields.push("opted_out_at = ?"); args.push(updates.optedOutAt); }

  await db.execute({
    sql: `UPDATE leads SET ${fields.join(", ")} WHERE id = ?`,
    args: [...args, id],
  });

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

export async function getRecentLeads(
  orgId: string,
  limit = 12,
  opts?: { source?: string; fit?: string },
): Promise<Lead[]> {
  const conditions = ["organization_id = ?"];
  const args: unknown[] = [orgId];
  if (opts?.source) { conditions.push("source = ?"); args.push(opts.source); }
  if (opts?.fit) { conditions.push("fit = ?"); args.push(opts.fit); }
  args.push(limit);
  const result = await db.execute({
    sql: `SELECT * FROM leads WHERE ${conditions.join(" AND ")} ORDER BY added_at DESC LIMIT ?`,
    args,
  });
  return result.rows.map((r) => rowToLead(r as Record<string, unknown>));
}

export async function getDistinctSources(orgId: string): Promise<string[]> {
  const result = await db.execute({
    sql: "SELECT DISTINCT source FROM leads WHERE organization_id = ? AND source IS NOT NULL AND source != '' ORDER BY source",
    args: [orgId],
  });
  return result.rows.map((r) => (r as Record<string, unknown>).source as string);
}

export async function deleteLead(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM leads WHERE id = ?", args: [id] });
}

export async function getLeadGrowth(
  orgId: string,
  days = 7,
  opts?: { source?: string; from?: string; to?: string },
): Promise<{ date: string; count: number }[]> {
  const from = opts?.from ? new Date(`${opts.from}T00:00:00`) : null;
  const to = opts?.to ? new Date(`${opts.to}T00:00:00`) : null;
  const interval = from && to
    ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
    : days - 1;
  const conditions = [
    "organization_id = ?",
  ];
  const args: unknown[] = [orgId];
  if (from && to) {
    conditions.push("added_at::date >= ?::date", "added_at::date <= ?::date");
    args.push(opts.from!, opts.to!);
  } else {
    conditions.push(`added_at >= (CURRENT_DATE - INTERVAL '${interval} days')::text`);
  }
  if (opts?.source) { conditions.push("source = ?"); args.push(opts.source); }
  const result = await db.execute({
    sql: `
      SELECT added_at::date as date, COUNT(*)::int as count
      FROM leads
      WHERE ${conditions.join(" AND ")}
      GROUP BY added_at::date
      ORDER BY date ASC
    `,
    args,
  });
  const map = new Map<string, number>();
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    map.set(r.date as string, Number(r.count));
  }
  const result2: { date: string; count: number }[] = [];
  for (let i = 0; i <= interval; i++) {
    const d = from ? new Date(from) : new Date();
    d.setDate(from ? d.getDate() + i : d.getDate() - (interval - i));
    const key = d.toISOString().split("T")[0];
    result2.push({ date: key, count: map.get(key) ?? 0 });
  }
  return result2;
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
