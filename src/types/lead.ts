export type LeadStatus =
  | "not_contacted"
  | "email_sent"
  | "linkedin_sent"
  | "instagram_sent"
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
  | "enrichment_failed"
  | "failed";

export interface Lead {
  id: string;
  organizationId: string;
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
  isValid: boolean | null;
  validationErrors: string[];
  websiteValid: boolean | null;
  personValid: boolean | null;
  companyValid: boolean | null;
  validatedAt: string | null;
  source: string | null;
  sourceDetails: Record<string, unknown>;
  lastVerifiedAt: string | null;
  enrichedAt: string | null;
  role: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  intentSignals: string[];
  engagementHistory: Record<string, unknown>[];
  scoreBreakdown: Record<string, number>;
  emailVerificationStatus: "verified" | "accept_all" | "not_found" | null;
  emailVerificationConfidence: number | null;
  emailVerificationProvider: string | null;
  emailVerifiedAt: string | null;
  optedOutAt: string | null;
  emailSentAt: string | null;
  linkedinSentAt: string | null;
  instagramSentAt: string | null;
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
  ceo?: string;
  email?: string;
  linkedin?: string;
  fit: FitRating;
  notes?: string;
  source?: string;
  sourceDetails?: Record<string, unknown>;
  role?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  intentSignals?: string[];
  engagementHistory?: Record<string, unknown>[];
  scoreBreakdown?: Record<string, number>;
  emailVerificationStatus?: "verified" | "accept_all" | "not_found" | null;
  emailVerificationConfidence?: number | null;
  emailVerificationProvider?: string | null;
  emailVerifiedAt?: string | null;
  optedOutAt?: string | null;
}

export interface UpdateLeadInput {
  emailVerificationStatus?: "verified" | "accept_all" | "not_found" | null;
  emailVerificationConfidence?: number | null;
  emailVerificationProvider?: string | null;
  emailVerifiedAt?: string | null;
  company?: string;
  ceo?: string;
  email?: string | null;
  status?: LeadStatus;
  notes?: string;
  emailSentAt?: string | null;
  linkedinSentAt?: string | null;
  instagramSentAt?: string | null;
  repliedAt?: string | null;
  pipelineStage?: PipelineStage;
  enrichmentAttempts?: number;
  fit?: FitRating;
  fitReason?: string | null;
  score?: number | null;
  website?: string;
  whatTheyDo?: string;
  linkedin?: string;
  isValid?: boolean | null;
  validationErrors?: string[];
  websiteValid?: boolean | null;
  personValid?: boolean | null;
  companyValid?: boolean | null;
  validatedAt?: string | null;
  sourceDetails?: Record<string, unknown>;
  lastVerifiedAt?: string | null;
  enrichedAt?: string | null;
  role?: string | null;
  industry?: string | null;
  companySize?: string | null;
  location?: string | null;
  intentSignals?: string[];
  engagementHistory?: Record<string, unknown>[];
  scoreBreakdown?: Record<string, number>;
}
