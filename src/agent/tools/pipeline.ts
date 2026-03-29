import {
  getPipelineSummary,
  createLead,
  updateLead as dbUpdateLead,
} from "~/db/queries/leads";
import type { Lead, LeadStatus, FitRating } from "~/types/lead";

export async function readPipelineSummary(orgId: string): Promise<string> {
  return getPipelineSummary(orgId);
}

export async function addLead(orgId: string, input: {
  company: string;
  website?: string;
  whatTheyDo?: string;
  ceo: string;
  email: string;
  linkedin?: string;
  fit: FitRating;
  notes?: string;
}): Promise<Lead> {
  return createLead(orgId, input);
}

export async function updateLead(
  id: string,
  updates: Partial<Lead> & { status?: LeadStatus },
): Promise<Lead> {
  return dbUpdateLead(id, {
    status: updates.status,
    notes: updates.notes,
    emailSentAt: updates.emailSentAt,
    linkedinSentAt: updates.linkedinSentAt,
    repliedAt: updates.repliedAt,
  });
}
