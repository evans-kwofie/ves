export type LeadStatus =
  | 'not_contacted'
  | 'email_sent'
  | 'linkedin_sent'
  | 'replied'
  | 'call_scheduled'
  | 'converted'
  | 'not_interested';

export type FitRating = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Lead {
  id: string;
  company: string;
  website: string;
  whatTheyDo: string;
  ceo: string;
  email: string;
  linkedin: string;
  fit: FitRating;
  status: LeadStatus;
  emailSentAt: string | null;
  linkedinSentAt: string | null;
  repliedAt: string | null;
  notes: string;
  addedAt: string;
}

export interface Pipeline {
  leads: Lead[];
  lastRun: string | null;
  weeklyTarget: number;
  totalEmailsSent: number;
  totalReplies: number;
}
