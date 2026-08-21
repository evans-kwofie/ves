import { db } from "~/db/client";
import {
  createEnrichmentAttempt,
  claimDueEnrichmentJob,
  failExpiredEnrichmentJobs,
  getLead,
  updateEnrichmentJob,
  updateLead,
} from "~/db/queries/leads";
import { findEmail, splitName } from "~/agent/tools/find-email";
import { enrichRedditLead, enrichStandardLead, validateLead } from "~/lib/lead-enrichment";
import { scoreLead } from "~/lib/lead-scoring";

const INTERVAL_MS = 30_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];
let started = false;
let running = false;

async function getOrgContext(organizationId: string) {
  const result = await db.execute({ sql: "SELECT name, metadata FROM organization WHERE id = ?", args: [organizationId] });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  let metadata: Record<string, string> = {};
  try { metadata = row?.metadata ? JSON.parse(row.metadata as string) as Record<string, string> : {}; } catch { /* use defaults */ }
  let focusAreas: string[] = [];
  try { focusAreas = metadata.useCases ? JSON.parse(metadata.useCases) as string[] : []; } catch { /* use defaults */ }
  return { name: (row?.name as string) ?? "", description: metadata.description ?? "", industry: metadata.industry ?? "", focusAreas, icp: metadata.icp ?? "", messaging: metadata.messaging ?? "" };
}

async function runJob(job: NonNullable<Awaited<ReturnType<typeof claimDueEnrichmentJob>>>) {
  const lead = await getLead(job.leadId);
  if (!lead) {
    await updateEnrichmentJob(job.id, { status: "failed", lastError: "Lead no longer exists", completedAt: new Date().toISOString() });
    return;
  }

  const attemptNumber = job.attempts;
  await updateLead(lead.id, { pipelineStage: "enriching", enrichmentAttempts: attemptNumber });

  try {
    const context = await getOrgContext(job.organizationId);
    const reddit = lead.source === "reddit" || lead.website.includes("reddit.com/user/");
    const result = reddit
      ? await enrichRedditLead({ id: lead.id, ceo: lead.ceo, notes: lead.notes }, context)
      : await enrichStandardLead({ id: lead.id, company: lead.company, ceo: lead.ceo, website: lead.website, whatTheyDo: lead.whatTheyDo, email: lead.email }, context);

    if (!result) throw new Error("No usable enrichment result returned");

    const person = result.realName ?? lead.ceo;
    const website = result.website ?? lead.website;
    const name = splitName(person);
    const emailResult = name.firstName && name.lastName && website
      ? await findEmail(name.firstName, name.lastName, website)
      : { email: null, confidence: 0, status: "not_found" as const };
    const email = emailResult.email ?? (result.email && !result.email.includes("placeholder") ? result.email : null);
    const emailVerification = email ? { emailVerificationStatus: emailResult.status, emailVerificationConfidence: emailResult.confidence, emailVerificationProvider: "hunter", emailVerifiedAt: new Date().toISOString() } : {};
    const company = reddit && result.company ? result.company : lead.company;
    const engagementHistory = mergePublicSignals(lead.engagementHistory, result.publicSignals);
    const validation = validateLead({ company, person, website, email, linkedin: result.linkedin ?? lead.linkedin, source: lead.source });
    const scored = scoreLead({ website, email, linkedin: result.linkedin ?? lead.linkedin, intentSignals: lead.intentSignals, role: result.role ?? lead.role, industry: result.industry ?? lead.industry, companySize: result.companySize ?? lead.companySize, location: result.location ?? lead.location, targetIndustry: context.industry, aiScore: result.score });

    if (validation.isValid) {
      await updateLead(lead.id, {
        pipelineStage: "validated", ...(reddit && result.realName ? { ceo: result.realName } : {}), ...(reddit && result.company ? { company: result.company } : {}),
        website, whatTheyDo: result.whatTheyDo || lead.whatTheyDo, linkedin: result.linkedin || lead.linkedin, role: result.role ?? lead.role, industry: result.industry ?? lead.industry, companySize: result.companySize ?? lead.companySize, location: result.location ?? lead.location,
        fit: scored.fit, score: scored.score, scoreBreakdown: scored.breakdown, fitReason: result.fitReason, engagementHistory, ...(email ? { email } : {}), ...emailVerification, ...validation, validatedAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString(), enrichedAt: new Date().toISOString(),
      });
      await createEnrichmentAttempt({ jobId: job.id, leadId: lead.id, attemptNumber, status: "succeeded", summary: "Company and outreach details validated", error: null });
      await updateEnrichmentJob(job.id, { status: "succeeded", completedAt: new Date().toISOString(), lockedAt: null, lastError: null });
      return;
    }

    const enrichedAt = new Date().toISOString();
    await updateLead(lead.id, { website, whatTheyDo: result.whatTheyDo || lead.whatTheyDo, linkedin: result.linkedin || lead.linkedin, role: result.role ?? lead.role, industry: result.industry ?? lead.industry, companySize: result.companySize ?? lead.companySize, location: result.location ?? lead.location, fit: scored.fit, score: scored.score, scoreBreakdown: scored.breakdown, fitReason: result.fitReason, engagementHistory, ...(email ? { email } : {}), ...emailVerification, ...validation, validatedAt: enrichedAt, lastVerifiedAt: enrichedAt, enrichedAt });
    throw new Error(validation.validationErrors.join(". "));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown enrichment error";
    const exhausted = attemptNumber >= job.maxAttempts;
    await createEnrichmentAttempt({ jobId: job.id, leadId: lead.id, attemptNumber, status: exhausted ? "failed" : "retrying", summary: null, error: message });
    await updateLead(lead.id, { pipelineStage: exhausted ? "enrichment_failed" : "discovered", enrichmentAttempts: attemptNumber });
    await updateEnrichmentJob(job.id, exhausted
      ? { status: "failed", lastError: message, completedAt: new Date().toISOString(), lockedAt: null }
      : { status: "queued", lastError: message, nextRunAt: new Date(Date.now() + RETRY_DELAYS_MS[attemptNumber - 1]).toISOString(), lockedAt: null });
  }
}

function mergePublicSignals(existing: Record<string, unknown>[], incoming: { summary: string; sourceUrl: string; publishedAt?: string }[]) {
  const signals = [...incoming, ...existing].filter((signal): signal is Record<string, unknown> => typeof signal === "object" && signal !== null);
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = typeof signal.sourceUrl === "string" ? signal.sourceUrl : typeof signal.summary === "string" ? signal.summary : "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const expiredJobs = await failExpiredEnrichmentJobs();
    await Promise.all(expiredJobs.map(async (job) => {
      await updateLead(job.leadId, { pipelineStage: "enrichment_failed", enrichmentAttempts: job.attempts });
      await createEnrichmentAttempt({ jobId: job.id, leadId: job.leadId, attemptNumber: job.attempts, status: "failed", summary: null, error: "Enrichment worker lease expired" });
    }));
    for (let count = 0; count < 10; count++) {
      const job = await claimDueEnrichmentJob();
      if (!job) break;
      await runJob(job);
    }
  } catch (error) {
    console.error("[enrichment-scheduler] Tick failed", error);
  } finally { running = false; }
}

export function startEnrichmentScheduler() {
  if (started) return;
  started = true;
  setTimeout(() => { void tick(); setInterval(() => void tick(), INTERVAL_MS); }, 10_000);
  console.log("[enrichment-scheduler] Started — checks queued jobs every 30 seconds");
}
