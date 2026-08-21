export type CampaignStatus = 'draft' | 'active' | 'paused' | 'scheduled' | 'completed';
export type CampaignChannel = 'email' | 'linkedin' | 'instagram' | 'reddit';
export type CampaignIntent = 'advice_seeking' | 'product_review' | 'audit_offer' | 'direct_pitch';

export type RunFrequency = 'daily' | 'every_3_days' | 'weekly';

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  status: CampaignStatus;
  channels: CampaignChannel[];
  goal: string | null;
  intentType: CampaignIntent | null;
  runFrequency: RunFrequency | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  sentCount: number;
  replyCount: number;
  batchSize: number;
  timezone: string;
  sendWindowStart: number;
  sendWindowEnd: number;
  weekdaysOnly: boolean;
  channelSendRules: Record<string, unknown>;
  scheduledStartAt: string | null;
}

export interface CreateCampaignInput {
  name: string;
  status?: CampaignStatus;
  channels?: CampaignChannel[];
  goal?: string;
  intentType?: CampaignIntent;
  leadIds?: string[];
  batchSize?: number;
  timezone?: string;
  sendWindowStart?: number;
  sendWindowEnd?: number;
  weekdaysOnly?: boolean;
  channelSendRules?: Record<string, unknown>;
  scheduledStartAt?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
  channels?: CampaignChannel[];
  goal?: string | null;
  intentType?: CampaignIntent | null;
  runFrequency?: RunFrequency | null;
  leadIds?: string[];
  batchSize?: number;
  timezone?: string;
  sendWindowStart?: number;
  sendWindowEnd?: number;
  weekdaysOnly?: boolean;
  channelSendRules?: Record<string, unknown>;
  scheduledStartAt?: string | null;
}
