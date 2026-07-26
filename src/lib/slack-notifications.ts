import axios from "axios";
import { db } from "~/db/client";

interface OrgSlackConfig {
  webhookUrl: string | null;
  events: {
    reply: boolean;
    bounce: boolean;
    drafts: boolean;
  };
}

async function getOrgSlackConfig(orgId: string): Promise<OrgSlackConfig> {
  try {
    const result = await db.execute({
      sql: "SELECT metadata FROM organization WHERE id = ? LIMIT 1",
      args: [orgId],
    });
    let meta: Record<string, string> = {};
    if (result.rows.length > 0) {
      const raw = (result.rows[0] as Record<string, unknown>).metadata;
      if (raw) meta = JSON.parse(raw as string) as Record<string, string>;
    }
    return {
      webhookUrl: (meta.slackWebhookUrl as string | undefined) ?? process.env.SLACK_WEBHOOK_URL ?? null,
      events: {
        reply:  meta.slackEventReply  !== "false",
        bounce: meta.slackEventBounce !== "false",
        drafts: meta.slackEventDrafts !== "false",
      },
    };
  } catch {
    return {
      webhookUrl: process.env.SLACK_WEBHOOK_URL ?? null,
      events: { reply: true, bounce: true, drafts: true },
    };
  }
}

type SlackBlock =
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "divider" }
  | { type: "context"; elements: { type: "mrkdwn"; text: string }[] };

async function send(webhookUrl: string, fallbackText: string, blocks: SlackBlock[]) {
  try {
    await axios.post(webhookUrl, { text: fallbackText, blocks });
  } catch (err) {
    console.error("[Slack] Failed to send notification:", err instanceof Error ? err.message : err);
  }
}

export async function notifyReply({
  orgId,
  leadName,
  company,
  source,
  campaignName,
}: {
  orgId: string;
  leadName: string;
  company: string;
  source?: string | null;
  campaignName?: string | null;
}) {
  const config = await getOrgSlackConfig(orgId);
  if (!config.webhookUrl || !config.events.reply) return;

  const contextItems: { type: "mrkdwn"; text: string }[] = [];
  if (campaignName) contextItems.push({ type: "mrkdwn", text: `Campaign: *${campaignName}*` });
  if (source) contextItems.push({ type: "mrkdwn", text: `Source: ${source}` });
  contextItems.push({ type: "mrkdwn", text: `Go to Vesper → pipeline` });

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎉 *Reply from ${leadName}* at *${company}*\nHead to the pipeline to continue the conversation.`,
      },
    },
  ];
  if (contextItems.length > 0) {
    blocks.push({ type: "context", elements: contextItems });
  }

  await send(
    config.webhookUrl,
    `🎉 Reply from ${leadName} at ${company}`,
    blocks,
  );
}

export async function notifyBounce({
  orgId,
  email,
  leadName,
  company,
}: {
  orgId: string;
  email: string;
  leadName?: string | null;
  company?: string | null;
}) {
  const config = await getOrgSlackConfig(orgId);
  if (!config.webhookUrl || !config.events.bounce) return;

  const who = leadName && company ? `*${leadName}* at *${company}*` : `\`${email}\``;

  await send(
    config.webhookUrl,
    `⚠️ Email bounced — ${email}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⚠️ *Email bounced*\nTo: ${who}\nTheir lead status has been reset. Update the contact info and retry.`,
        },
      },
    ],
  );
}

export async function notifyDraftsReady({
  orgId,
  campaignName,
  count,
}: {
  orgId: string;
  campaignName: string;
  count: number;
}) {
  const config = await getOrgSlackConfig(orgId);
  if (!config.webhookUrl || !config.events.drafts) return;

  await send(
    config.webhookUrl,
    `✉️ ${count} draft${count !== 1 ? "s" : ""} ready — ${campaignName}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `✉️ *${count} draft${count !== 1 ? "s" : ""} ready for approval*\nCampaign: *${campaignName}*\nOpen Vesper to review and send.`,
        },
      },
    ],
  );
}

export async function notifyNewLeads({
  orgId,
  count,
  highFitCount,
  source,
}: {
  orgId: string;
  count: number;
  highFitCount: number;
  source?: string;
}) {
  const config = await getOrgSlackConfig(orgId);
  if (!config.webhookUrl || !config.events.reply) return;

  const sourceLabel = source ? ` from ${source}` : "";
  const highFitNote = highFitCount > 0 ? `\n${highFitCount} are *HIGH fit* 🔥` : "";

  await send(
    config.webhookUrl,
    `📥 ${count} new leads${sourceLabel}`,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📥 *${count} new lead${count !== 1 ? "s" : ""} discovered${sourceLabel}*${highFitNote}`,
        },
      },
    ],
  );
}
