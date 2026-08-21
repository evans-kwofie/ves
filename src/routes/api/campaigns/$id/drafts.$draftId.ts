import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDraft, updateDraft, scheduleDraftForNextStep, getDailySendCount, getCampaignDailySendCount, getCampaignChannelDailySendCount } from "~/db/queries/drafts";
import { getLead, updateLead, createOutreachEvent } from "~/db/queries/leads";
import { getNextStep } from "~/db/queries/steps";
import { getCampaign } from "~/db/queries/campaigns";
import { db } from "~/db/client";
import { sendEmail } from "~/agent/tools/email";
import { verifyEmail } from "~/agent/tools/find-email";
import { recordProviderAuditEvent } from "~/db/queries/provider-audit";
import { channelRule, checkSendWindow } from "~/lib/campaign-send-policy";

async function getOrgSendSettings(orgId: string): Promise<{
  dailySendCap: number;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendWeekdaysOnly: boolean;
}> {
  try {
    const result = await db.execute({
      sql: "SELECT metadata FROM organization WHERE id = ?",
      args: [orgId],
    });
    if (result.rows.length === 0) return defaults();
    const raw = (result.rows[0] as Record<string, unknown>).metadata;
    if (!raw) return defaults();
    const meta = JSON.parse(raw as string) as Record<string, string>;
    return {
      dailySendCap: meta.dailySendCap ? Number(meta.dailySendCap) : 50,
      sendWindowStart: meta.sendWindowStart ? Number(meta.sendWindowStart) : 8,
      sendWindowEnd: meta.sendWindowEnd ? Number(meta.sendWindowEnd) : 18,
      sendWeekdaysOnly: meta.sendWeekdaysOnly !== "false",
    };
  } catch {
    return defaults();
  }
}

function defaults() {
  return { dailySendCap: 50, sendWindowStart: 8, sendWindowEnd: 18, sendWeekdaysOnly: true };
}

async function maybeScheduleNextStep(
  campaignId: string,
  leadId: string,
  currentStepNumber: number,
  sentAt: string,
): Promise<void> {
  const nextStep = await getNextStep(campaignId, currentStepNumber);
  if (!nextStep) return;
  const sendAfter = new Date(
    new Date(sentAt).getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  await scheduleDraftForNextStep({
    campaignId,
    leadId,
    nextStepNumber: nextStep.stepNumber,
    channel: nextStep.channel,
    sendAfter,
  });
}

const editSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
});

export const Route = createFileRoute("/api/campaigns/$id/drafts/$draftId")({
  server: {
    handlers: {
      // Edit draft content
      PUT: async ({ params, request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const parsed = editSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        const draft = await updateDraft(params.draftId, parsed.data);
        return Response.json(draft);
      },

      // Draft review transitions: pending → approved → sending → sent/failed.
      POST: async ({ params, request }) => {
        let action = "approve";
        let allowRiskyEmail = false;
        try {
          const body = await request.json() as { action?: string; allowRiskyEmail?: boolean };
          action = body.action ?? "approve";
          allowRiskyEmail = body.allowRiskyEmail === true;
        } catch { /* default approve */ }

        const draft = await getDraft(params.draftId);
        if (!draft) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }

        if (draft.status === "sending") {
          return new Response(JSON.stringify({ error: "send_in_progress" }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        if (draft.status === "sent") {
          return Response.json({ ok: true, draft, alreadySent: true });
        }

        if (action === "skip") {
          const updated = await updateDraft(params.draftId, { status: "skipped" });
          return Response.json({ ok: true, draft: updated });
        }

        if (action === "approve") {
          if (draft.status !== "pending" && draft.status !== "failed") {
            return new Response(JSON.stringify({ error: "draft_not_reviewable" }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
          const updated = await updateDraft(params.draftId, { status: "approved" });
          return Response.json({ ok: true, draft: updated });
        }

        if (action === "mark_sent") {
          const campaign = await getCampaign(draft.campaignId);
          if (campaign) {
            const rule = channelRule(campaign.channelSendRules, draft.channel as "linkedin" | "instagram");
            const block = checkSendWindow({ timezone: campaign.timezone, windowStart: rule.windowStart ?? campaign.sendWindowStart, windowEnd: rule.windowEnd ?? campaign.sendWindowEnd, weekdaysOnly: rule.weekdaysOnly ?? campaign.weekdaysOnly });
            const sent = await getCampaignChannelDailySendCount(campaign.id, draft.channel);
            if (block || (rule.maxPerDay != null && sent >= rule.maxPerDay)) return new Response(JSON.stringify({ error: block ?? "channel_daily_cap_reached" }), { status: 429, headers: { "Content-Type": "application/json" } });
          }
          const lead = await getLead(draft.leadId);
          const now = new Date().toISOString();
          const socialUpdate = draft.channel === "instagram"
            ? { status: "instagram_sent" as const, instagramSentAt: now }
            : { status: "linkedin_sent" as const, linkedinSentAt: now };
          const [updated] = await Promise.all([
            updateDraft(params.draftId, { status: "sent", sentAt: now }),
            lead ? updateLead(lead.id, socialUpdate) : Promise.resolve(null),
            lead ? createOutreachEvent({ leadId: lead.id, channel: draft.channel, status: "sent", sentAt: now, campaignId: draft.campaignId }) : Promise.resolve(null),
          ]);
          // Schedule next step if lead hasn't replied
          if (lead && !lead.repliedAt && draft.stepNumber != null) {
            await maybeScheduleNextStep(draft.campaignId, draft.leadId, draft.stepNumber, now);
          }
          return Response.json({ ok: true, draft: updated });
        }

        if (action !== "send") {
          return new Response(JSON.stringify({ error: "invalid_action" }), { status: 422, headers: { "Content-Type": "application/json" } });
        }
        if (draft.status !== "approved") {
          return new Response(JSON.stringify({ error: "draft_not_approved", message: "Approve this draft before sending." }), { status: 409, headers: { "Content-Type": "application/json" } });
        }

        // Send an approved email draft.
        const lead = await getLead(draft.leadId);
        if (!lead || !lead.email) {
          return new Response(JSON.stringify({ error: "lead_no_email" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (lead.optedOutAt) {
          await updateDraft(params.draftId, { status: "skipped" });
          return new Response(JSON.stringify({ error: "lead_opted_out" }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        let verificationStatus = lead.emailVerificationStatus;
        if (verificationStatus !== "verified") {
          const verification = await verifyEmail(lead.email);
          if (verification) {
            verificationStatus = verification.status;
            await updateLead(lead.id, { emailVerificationStatus: verification.status, emailVerificationConfidence: verification.confidence, emailVerificationProvider: "hunter", emailVerifiedAt: new Date().toISOString() });
          }
        }
        if (verificationStatus === "not_found") {
          await updateDraft(params.draftId, { status: "skipped" });
          await recordProviderAuditEvent({ provider: "resend", eventType: "email.send", outcome: "failed", leadId: lead.id, campaignDraftId: draft.id, detail: { recipient: lead.email, error: "email_not_verified" } });
          return new Response(JSON.stringify({ error: "email_not_verified", message: "This address was marked invalid during verification." }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        if (verificationStatus === "accept_all" && !allowRiskyEmail) {
          return new Response(JSON.stringify({ error: "accept_all_requires_confirmation", message: "This address is on a catch-all domain and cannot be fully verified. Confirm to send anyway." }), { status: 409, headers: { "Content-Type": "application/json" } });
        }

        // Enforce send scheduling rules
        const campaign = await getCampaign(draft.campaignId);
        if (campaign) {
          if (campaign.status === "paused" || campaign.status === "completed") {
            return new Response(JSON.stringify({ error: "campaign_not_sending", message: "Resume this campaign before sending." }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
          const settings = await getOrgSendSettings(campaign.organizationId);
          if (campaign.scheduledStartAt && new Date(campaign.scheduledStartAt).getTime() > Date.now()) return new Response(JSON.stringify({ error: "campaign_not_started" }), { status: 403 });
          const rule = channelRule(campaign.channelSendRules, "email");
          const blocked = checkSendWindow({ timezone: campaign.timezone, windowStart: rule.windowStart ?? campaign.sendWindowStart, windowEnd: rule.windowEnd ?? campaign.sendWindowEnd, weekdaysOnly: rule.weekdaysOnly ?? campaign.weekdaysOnly });
          if (blocked) return new Response(JSON.stringify({ error: "outside_send_window", message: "Outside this channel's configured send window." }), { status: 403, headers: { "Content-Type": "application/json" } });
          const [sentToday, campaignSentToday] = await Promise.all([getDailySendCount(campaign.organizationId), getCampaignDailySendCount(campaign.id)]);
          const channelSent = await getCampaignChannelDailySendCount(campaign.id, "email");
          if (sentToday >= settings.dailySendCap || campaignSentToday >= campaign.batchSize || (rule.maxPerDay != null && channelSent >= rule.maxPerDay)) {
            return new Response(JSON.stringify({ error: "daily_cap_reached", message: `Campaign daily batch limit of ${campaign.batchSize} reached. Try again tomorrow.` }), { status: 429, headers: { "Content-Type": "application/json" } });
          }
        }

        const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN;
        const replyTo = inboundDomain ? `reply+${lead.id}@${inboundDomain}` : undefined;

        await updateDraft(params.draftId, { status: "sending" });

        const result = await sendEmail({
          to: lead.email,
          subject: draft.subject ?? "(no subject)",
          body: draft.body,
          replyTo,
        });

        if (!result.success) {
          await recordProviderAuditEvent({ provider: "resend", eventType: "email.send", outcome: "failed", leadId: lead.id, campaignDraftId: draft.id, detail: { recipient: lead.email, error: result.error ?? "send_failed" } });
          await updateDraft(params.draftId, { status: "failed" });
          return new Response(JSON.stringify({ error: result.error ?? "send_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const now = new Date().toISOString();
        await recordProviderAuditEvent({ provider: "resend", eventType: "email.send", outcome: "succeeded", leadId: lead.id, campaignDraftId: draft.id, providerMessageId: result.messageId, detail: { recipient: lead.email } });
        const [updated] = await Promise.all([
          updateDraft(params.draftId, { status: "sent", sentAt: now, resendMessageId: result.messageId ?? undefined }),
          updateLead(lead.id, { status: "email_sent", emailSentAt: now }),
          createOutreachEvent({
            leadId: lead.id,
            channel: draft.channel,
            status: "email_sent",
            sentAt: now,
            campaignId: draft.campaignId,
          }),
        ]);

        // Schedule next step if lead hasn't replied
        if (!lead.repliedAt && draft.stepNumber != null) {
          await maybeScheduleNextStep(draft.campaignId, draft.leadId, draft.stepNumber, now);
        }

        return Response.json({ ok: true, draft: updated, messageId: result.messageId });
      },
    },
  },
});
