import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { Lead, Pipeline, LeadStatus, FitRating } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE_PATH = path.resolve(__dirname, '../../../../private/pipeline.json');

const DEFAULT_PIPELINE: Pipeline = {
  leads: [],
  lastRun: null,
  weeklyTarget: 10,
  totalEmailsSent: 0,
  totalReplies: 0,
};

export async function readPipeline(): Promise<Pipeline> {
  try {
    const raw = await fs.readFile(PIPELINE_PATH, 'utf-8');
    return JSON.parse(raw) as Pipeline;
  } catch {
    return DEFAULT_PIPELINE;
  }
}

// Returns a compact summary to reduce token usage in the agent loop
export async function readPipelineSummary(): Promise<string> {
  const pipeline = await readPipeline();
  const lines = pipeline.leads.map((l) => {
    const daysSinceEmail = l.emailSentAt
      ? Math.floor((Date.now() - new Date(l.emailSentAt).getTime()) / 86400000)
      : null;
    return `id:${l.id} | ${l.company} (${l.ceo}) | ${l.email} | fit:${l.fit} | status:${l.status}${daysSinceEmail !== null ? ` | email_sent_${daysSinceEmail}d_ago` : ''}${l.notes ? ` | notes:${l.notes.slice(0, 60)}` : ''}`;
  });
  return [
    `Total leads: ${pipeline.leads.length} | Emails sent: ${pipeline.totalEmailsSent} | Replies: ${pipeline.totalReplies} | Target: ${pipeline.weeklyTarget}`,
    ...lines,
  ].join('\n');
}

export async function writePipeline(pipeline: Pipeline): Promise<void> {
  await fs.mkdir(path.dirname(PIPELINE_PATH), { recursive: true });
  await fs.writeFile(PIPELINE_PATH, JSON.stringify(pipeline, null, 2), 'utf-8');
}

export async function addLead(input: {
  company: string;
  website?: string;
  whatTheyDo?: string;
  ceo: string;
  email: string;
  linkedin?: string;
  fit: FitRating;
  notes?: string;
}): Promise<Lead> {
  const pipeline = await readPipeline();
  const existing = pipeline.leads.find(
    (l) => l.email.toLowerCase() === input.email.toLowerCase(),
  );
  if (existing) {
    throw new Error(`Lead with email ${input.email} already exists (id: ${existing.id})`);
  }

  const lead: Lead = {
    id: uuidv4(),
    company: input.company,
    website: input.website ?? '',
    whatTheyDo: input.whatTheyDo ?? '',
    ceo: input.ceo,
    email: input.email,
    linkedin: input.linkedin ?? '',
    fit: input.fit,
    status: 'not_contacted',
    emailSentAt: null,
    linkedinSentAt: null,
    repliedAt: null,
    notes: input.notes ?? '',
    addedAt: new Date().toISOString(),
  };

  pipeline.leads.push(lead);
  await writePipeline(pipeline);
  return lead;
}

export async function updateLead(
  id: string,
  updates: Partial<Lead> & { status?: LeadStatus },
): Promise<Lead> {
  const pipeline = await readPipeline();
  const idx = pipeline.leads.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error(`Lead not found: ${id}`);

  pipeline.leads[idx] = { ...pipeline.leads[idx], ...updates };

  if (updates.status === 'email_sent' && !pipeline.leads[idx].emailSentAt) {
    pipeline.leads[idx].emailSentAt = new Date().toISOString();
    pipeline.totalEmailsSent++;
  }
  if (updates.status === 'replied' && !pipeline.leads[idx].repliedAt) {
    pipeline.leads[idx].repliedAt = new Date().toISOString();
    pipeline.totalReplies++;
  }

  pipeline.lastRun = new Date().toISOString();
  await writePipeline(pipeline);
  return pipeline.leads[idx];
}
