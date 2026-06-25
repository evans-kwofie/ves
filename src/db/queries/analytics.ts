import { db } from "../client";

export interface WorkspaceStats {
  totalLeads: number;
  totalContacted: number;
  totalReplied: number;
  convertedLeads: number;
  emailSent: number;
  emailOpened: number;
  emailClicked: number;
  emailBounced: number;
  emailDelivered: number;
  linkedinSent: number;
  instagramSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  deliveryRate: number;
  conversionRate: number;
}

export interface SubjectStat {
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

export interface SourceStat {
  source: string;
  total: number;
  contacted: number;
  replied: number;
  replyRate: number;
}

export interface CampaignStat {
  id: string;
  name: string;
  status: string;
  leadCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  repliedCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  hasAB: boolean;
}

export interface DailyVolume {
  date: string;
  sent: number;
}

export interface StepDropoff {
  campaignId: string;
  campaignName: string;
  stepNumber: number;
  sent: number;
  replied: number;
  replyRate: number;
}

export interface ABSummary {
  campaignsWithAB: number;
  aWins: number;
  bWins: number;
  tied: number;
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 100);
}

export async function getWorkspaceStats(orgId: string): Promise<WorkspaceStats> {
  const [leadRow, draftRow] = await Promise.all([
    db.execute({
      sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL OR linkedin_sent_at IS NOT NULL)::int AS contacted,
        COUNT(*) FILTER (WHERE replied_at IS NOT NULL)::int AS replied,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted
      FROM leads WHERE organization_id = ?`,
      args: [orgId],
    }),
    db.execute({
      sql: `SELECT
        COUNT(*) FILTER (WHERE cd.status = 'sent' AND cd.channel = 'email')::int        AS email_sent,
        COUNT(*) FILTER (WHERE cd.opened_at IS NOT NULL AND cd.channel = 'email')::int   AS email_opened,
        COUNT(*) FILTER (WHERE cd.clicked_at IS NOT NULL AND cd.channel = 'email')::int  AS email_clicked,
        COUNT(*) FILTER (WHERE cd.bounced_at IS NOT NULL AND cd.channel = 'email')::int  AS email_bounced,
        COUNT(*) FILTER (WHERE cd.status = 'sent' AND cd.channel = 'linkedin')::int      AS linkedin_sent,
        COUNT(*) FILTER (WHERE cd.status = 'sent' AND cd.channel = 'instagram')::int     AS instagram_sent
      FROM campaign_drafts cd
      JOIN campaigns c ON c.id = cd.campaign_id
      WHERE c.organization_id = ?`,
      args: [orgId],
    }),
  ]);

  const l = leadRow.rows[0] ?? {};
  const d = draftRow.rows[0] ?? {};

  const totalLeads = Number(l.total ?? 0);
  const totalContacted = Number(l.contacted ?? 0);
  const totalReplied = Number(l.replied ?? 0);
  const convertedLeads = Number(l.converted ?? 0);
  const emailSent = Number(d.email_sent ?? 0);
  const emailOpened = Number(d.email_opened ?? 0);
  const emailClicked = Number(d.email_clicked ?? 0);
  const emailBounced = Number(d.email_bounced ?? 0);
  const emailDelivered = Math.max(0, emailSent - emailBounced);
  const linkedinSent = Number(d.linkedin_sent ?? 0);
  const instagramSent = Number(d.instagram_sent ?? 0);

  return {
    totalLeads,
    totalContacted,
    totalReplied,
    convertedLeads,
    emailSent,
    emailOpened,
    emailClicked,
    emailBounced,
    emailDelivered,
    linkedinSent,
    instagramSent,
    openRate: pct(emailOpened, emailSent),
    clickRate: pct(emailClicked, emailSent),
    replyRate: pct(totalReplied, totalContacted),
    bounceRate: pct(emailBounced, emailSent),
    deliveryRate: pct(emailDelivered, emailSent),
    conversionRate: pct(convertedLeads, totalContacted),
  };
}

export async function getCampaignStats(orgId: string): Promise<CampaignStat[]> {
  const [campaignsResult, repliesResult] = await Promise.all([
    db.execute({
      sql: `SELECT
        c.id, c.name, c.status,
        COUNT(DISTINCT cl.lead_id)::int AS lead_count,
        COUNT(cd.id) FILTER (WHERE cd.status = 'sent')::int AS sent_count,
        COUNT(cd.id) FILTER (WHERE cd.opened_at IS NOT NULL)::int AS opened_count,
        COUNT(cd.id) FILTER (WHERE cd.clicked_at IS NOT NULL)::int AS clicked_count,
        COUNT(cd.id) FILTER (WHERE cd.bounced_at IS NOT NULL)::int AS bounced_count,
        COUNT(cd.id) FILTER (WHERE cd.ab_variant = 'b')::int AS b_count
      FROM campaigns c
      LEFT JOIN campaign_leads cl ON cl.campaign_id = c.id
      LEFT JOIN campaign_drafts cd ON cd.campaign_id = c.id
      WHERE c.organization_id = ?
      GROUP BY c.id, c.name, c.status
      ORDER BY c.created_at DESC`,
      args: [orgId],
    }),
    db.execute({
      sql: `SELECT cl.campaign_id, COUNT(*)::int AS replied_count
        FROM campaign_leads cl
        JOIN leads l ON l.id = cl.lead_id
        WHERE l.replied_at IS NOT NULL
        GROUP BY cl.campaign_id`,
      args: [],
    }),
  ]);

  const repliedByCampaign = new Map<string, number>();
  for (const row of repliesResult.rows) {
    repliedByCampaign.set(row.campaign_id as string, Number(row.replied_count ?? 0));
  }

  return campaignsResult.rows.map((row) => {
    const id = row.id as string;
    const sentCount = Number(row.sent_count ?? 0);
    const openedCount = Number(row.opened_count ?? 0);
    const clickedCount = Number(row.clicked_count ?? 0);
    const bouncedCount = Number(row.bounced_count ?? 0);
    const repliedCount = repliedByCampaign.get(id) ?? 0;
    const leadCount = Number(row.lead_count ?? 0);
    const hasAB = Number(row.b_count ?? 0) > 0;

    return {
      id,
      name: row.name as string,
      status: row.status as string,
      leadCount,
      sentCount,
      openedCount,
      clickedCount,
      bouncedCount,
      repliedCount,
      openRate: pct(openedCount, sentCount),
      clickRate: pct(clickedCount, sentCount),
      replyRate: pct(repliedCount, leadCount > 0 ? leadCount : sentCount),
      bounceRate: pct(bouncedCount, sentCount),
      hasAB,
    };
  });
}

export async function getSendVolume(orgId: string, days = 30): Promise<DailyVolume[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.execute({
    sql: `SELECT LEFT(cd.sent_at, 10) AS day, COUNT(*)::int AS count
      FROM campaign_drafts cd
      JOIN campaigns c ON c.id = cd.campaign_id
      WHERE c.organization_id = ?
        AND cd.status = 'sent'
        AND cd.sent_at >= ?
      GROUP BY day
      ORDER BY day ASC`,
    args: [orgId, since],
  });

  const byDate = new Map<string, number>();
  for (const row of result.rows) {
    byDate.set(row.day as string, Number(row.count ?? 0));
  }

  const filled: DailyVolume[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    filled.push({ date: dateStr, sent: byDate.get(dateStr) ?? 0 });
  }
  return filled;
}

export async function getStepDropoff(orgId: string): Promise<StepDropoff[]> {
  const [sentResult, repliedResult] = await Promise.all([
    db.execute({
      sql: `SELECT c.id AS campaign_id, c.name AS campaign_name, cd.step_number,
          COUNT(*) FILTER (WHERE cd.status = 'sent')::int AS sent
        FROM campaign_drafts cd
        JOIN campaigns c ON c.id = cd.campaign_id
        WHERE c.organization_id = ? AND cd.step_number IS NOT NULL
        GROUP BY c.id, c.name, cd.step_number
        ORDER BY c.id, cd.step_number`,
      args: [orgId],
    }),
    db.execute({
      sql: `SELECT cd.campaign_id, cd.step_number, COUNT(*)::int AS replied
        FROM campaign_drafts cd
        JOIN leads l ON l.id = cd.lead_id
        JOIN campaigns c ON c.id = cd.campaign_id
        WHERE c.organization_id = ? AND l.replied_at IS NOT NULL AND cd.status = 'sent'
          AND cd.step_number IS NOT NULL
        GROUP BY cd.campaign_id, cd.step_number`,
      args: [orgId],
    }),
  ]);

  const repliedMap = new Map<string, number>();
  for (const row of repliedResult.rows) {
    repliedMap.set(`${row.campaign_id}:${row.step_number}`, Number(row.replied ?? 0));
  }

  return sentResult.rows.map((row) => {
    const campaignId = row.campaign_id as string;
    const stepNumber = row.step_number as number;
    const sent = Number(row.sent ?? 0);
    const replied = repliedMap.get(`${campaignId}:${stepNumber}`) ?? 0;
    return {
      campaignId,
      campaignName: row.campaign_name as string,
      stepNumber,
      sent,
      replied,
      replyRate: pct(replied, sent),
    };
  });
}

export async function getABSummary(orgId: string): Promise<ABSummary> {
  const [sentResult, repliedResult] = await Promise.all([
    db.execute({
      sql: `SELECT cd.campaign_id, cd.ab_variant,
          COUNT(*) FILTER (WHERE cd.status = 'sent')::int AS sent
        FROM campaign_drafts cd
        JOIN campaigns c ON c.id = cd.campaign_id
        WHERE c.organization_id = ? AND cd.ab_variant IN ('a','b')
        GROUP BY cd.campaign_id, cd.ab_variant`,
      args: [orgId],
    }),
    db.execute({
      sql: `SELECT cd.campaign_id, cd.ab_variant, COUNT(*)::int AS replied
        FROM campaign_drafts cd
        JOIN leads l ON l.id = cd.lead_id
        JOIN campaigns c ON c.id = cd.campaign_id
        WHERE c.organization_id = ? AND cd.status = 'sent'
          AND cd.ab_variant IN ('a','b') AND l.replied_at IS NOT NULL
        GROUP BY cd.campaign_id, cd.ab_variant`,
      args: [orgId],
    }),
  ]);

  type VData = { sent: number; replied: number };
  const bycamp = new Map<string, { a?: VData; b?: VData }>();

  for (const row of sentResult.rows) {
    const cid = row.campaign_id as string;
    const v = row.ab_variant as "a" | "b";
    if (!bycamp.has(cid)) bycamp.set(cid, {});
    bycamp.get(cid)![v] = { sent: Number(row.sent ?? 0), replied: 0 };
  }
  for (const row of repliedResult.rows) {
    const cid = row.campaign_id as string;
    const v = row.ab_variant as "a" | "b";
    const existing = bycamp.get(cid)?.[v];
    if (existing) existing.replied = Number(row.replied ?? 0);
  }

  let campaignsWithAB = 0, aWins = 0, bWins = 0, tied = 0;
  for (const [, data] of bycamp) {
    if (!data.a || !data.b) continue;
    campaignsWithAB++;
    const aRate = pct(data.a.replied, data.a.sent);
    const bRate = pct(data.b.replied, data.b.sent);
    if (aRate > bRate) aWins++;
    else if (bRate > aRate) bWins++;
    else tied++;
  }

  return { campaignsWithAB, aWins, bWins, tied };
}

export async function getTopSubjects(orgId: string, limit = 8): Promise<SubjectStat[]> {
  const result = await db.execute({
    sql: `SELECT
        cd.subject,
        COUNT(*) FILTER (WHERE cd.status = 'sent')::int                      AS sent,
        COUNT(*) FILTER (WHERE cd.opened_at IS NOT NULL)::int                AS opened,
        COUNT(*) FILTER (WHERE cd.clicked_at IS NOT NULL)::int               AS clicked
      FROM campaign_drafts cd
      JOIN campaigns c ON c.id = cd.campaign_id
      WHERE c.organization_id = ?
        AND cd.channel = 'email'
        AND cd.subject IS NOT NULL
        AND cd.subject != ''
      GROUP BY cd.subject
      HAVING COUNT(*) FILTER (WHERE cd.status = 'sent') > 0
      ORDER BY (COUNT(*) FILTER (WHERE cd.opened_at IS NOT NULL)::float /
                NULLIF(COUNT(*) FILTER (WHERE cd.status = 'sent'), 0)) DESC
      LIMIT ?`,
    args: [orgId, limit],
  });

  return result.rows.map((row) => {
    const sent = Number(row.sent ?? 0);
    const opened = Number(row.opened ?? 0);
    const clicked = Number(row.clicked ?? 0);
    return {
      subject: row.subject as string,
      sent,
      opened,
      clicked,
      openRate: pct(opened, sent),
      clickRate: pct(clicked, sent),
    };
  });
}

export async function getSourcePerformance(orgId: string): Promise<SourceStat[]> {
  const result = await db.execute({
    sql: `SELECT
        COALESCE(l.source, 'Unknown') AS source,
        COUNT(*)::int                                                                              AS total,
        COUNT(*) FILTER (WHERE l.email_sent_at IS NOT NULL OR l.linkedin_sent_at IS NOT NULL)::int AS contacted,
        COUNT(*) FILTER (WHERE l.replied_at IS NOT NULL)::int                                     AS replied
      FROM leads l
      WHERE l.organization_id = ?
      GROUP BY COALESCE(l.source, 'Unknown')
      ORDER BY total DESC`,
    args: [orgId],
  });

  return result.rows.map((row) => {
    const total = Number(row.total ?? 0);
    const contacted = Number(row.contacted ?? 0);
    const replied = Number(row.replied ?? 0);
    return {
      source: row.source as string,
      total,
      contacted,
      replied,
      replyRate: pct(replied, contacted),
    };
  });
}
