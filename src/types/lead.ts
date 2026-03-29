export type LeadStatus =
  | "not_contacted"
  | "email_sent"
  | "linkedin_sent"
  | "replied"
  | "call_scheduled"
  | "converted"
  | "not_interested";

export type FitRating = "HIGH" | "MEDIUM" | "LOW";

export type PipelineStage =
  | "discovered"
  | "enriching"
  | "enriched"
  | "validated"
  | "failed";

export interface Lead {
  id: string;
  company: string;
  website: string;
  whatTheyDo: string;
  ceo: string;
  email: string;
  linkedin: string;
  fit: FitRating;
  fitReason: string | null;
  score: number | null;
  status: LeadStatus;
  pipelineStage: PipelineStage;
  enrichmentAttempts: number;
  source: string | null;
  emailSentAt: string | null;
  linkedinSentAt: string | null;
  repliedAt: string | null;
  notes: string;
  addedAt: string;
}

export interface PipelineMeta {
  weeklyTarget: number;
  totalEmailsSent: number;
  totalReplies: number;
  lastRun: string | null;
}

export interface Pipeline {
  leads: Lead[];
  meta: PipelineMeta;
}

export interface CreateLeadInput {
  company: string;
  website?: string;
  whatTheyDo?: string;
  ceo: string;
  email: string;
  linkedin?: string;
  fit: FitRating;
  notes?: string;
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  notes?: string;
  emailSentAt?: string | null;
  linkedinSentAt?: string | null;
  repliedAt?: string | null;
  pipelineStage?: PipelineStage;
  enrichmentAttempts?: number;
  fit?: FitRating;
  fitReason?: string;
  score?: number;
  website?: string;
  whatTheyDo?: string;
  linkedin?: string;
}
