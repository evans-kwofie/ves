export type CampaignStatus = 'draft' | 'active' | 'scheduled' | 'completed';
export type CampaignChannel = 'email' | 'linkedin' | 'both';

export type RunFrequency = 'daily' | 'every_3_days' | 'weekly';

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel | null;
  goal: string | null;
  runFrequency: RunFrequency | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  sentCount: number;
  replyCount: number;
}

export interface CreateCampaignInput {
  name: string;
  status?: CampaignStatus;
  channel?: CampaignChannel;
  goal?: string;
  leadIds?: string[];
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
  channel?: CampaignChannel;
  goal?: string;
  runFrequency?: RunFrequency | null;
}
