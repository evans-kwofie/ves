import { v4 as uuidv4 } from "uuid";
import {
  getPipelineSummary,
  createLead,
  updateLead as dbUpdateLead,
} from "~/db/queries/leads";
import type { Lead, LeadStatus, FitRating } from "~/types/lead";

export { getPipelineSummary as readPipelineSummary };

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
  return createLead(input);
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
