import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDraft, updateDraft, scheduleDraftForNextStep, getDailySendCount } from "~/db/queries/drafts";
import { getLead, updateLead, createOutreachEvent } from "~/db/queries/leads";
import { getNextStep } from "~/db/queries/steps";
import { getCampaign } from "~/db/queries/campaigns";
import { db } from "~/db/client";
import { sendEmail } from "~/agent/tools/email";

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

      // Approve draft → send
      POST: async ({ params, request }) => {
        let action = "approve";
        try {
          const body = await request.json() as { action?: string };
          action = body.action ?? "approve";
        } catch { /* default approve */ }

        const draft = await getDraft(params.draftId);
        if (!draft) {
          return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }

        if (action === "skip") {
          const updated = await updateDraft(params.draftId, { status: "skipped" });
          return Response.json({ ok: true, draft: updated });
        }

        if (action === "mark_sent") {
          const lead = await getLead(draft.leadId);
          const now = new Date().toISOString();
          const [updated] = await Promise.all([
            updateDraft(params.draftId, { status: "sent", sentAt: now }),
            lead ? updateLead(lead.id, { linkedinSentAt: now }) : Promise.resolve(null),
            lead ? createOutreachEvent({ leadId: lead.id, channel: draft.channel, status: "linkedin_sent", sentAt: now, campaignId: draft.campaignId }) : Promise.resolve(null),
          ]);
          // Schedule next step if lead hasn't replied
          if (lead && !lead.repliedAt && draft.stepNumber != null) {
            await maybeScheduleNextStep(draft.campaignId, draft.leadId, draft.stepNumber, now);
          }
          return Response.json({ ok: true, draft: updated });
        }

        // Approve: send the email
        const lead = await getLead(draft.leadId);
        if (!lead || !lead.email) {
          return new Response(JSON.stringify({ error: "lead_no_email" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // Enforce send scheduling rules
        const campaign = await getCampaign(draft.campaignId);
        if (campaign) {
          const settings = await getOrgSendSettings(campaign.organizationId);
          const now = new Date();
          const hour = now.getHours();
          const day = now.getDay(); // 0 = Sun, 6 = Sat

          if (settings.sendWeekdaysOnly && (day === 0 || day === 6)) {
            return new Response(JSON.stringify({ error: "outside_send_window", message: "Send scheduling is set to weekdays only." }), { status: 403, headers: { "Content-Type": "application/json" } });
          }
          if (hour < settings.sendWindowStart || hour >= settings.sendWindowEnd) {
            return new Response(JSON.stringify({ error: "outside_send_window", message: `Outside send window (${settings.sendWindowStart}:00–${settings.sendWindowEnd}:00).` }), { status: 403, headers: { "Content-Type": "application/json" } });
          }
          const sentToday = await getDailySendCount(campaign.organizationId);
          if (sentToday >= settings.dailySendCap) {
            return new Response(JSON.stringify({ error: "daily_cap_reached", message: `Daily send cap of ${settings.dailySendCap} reached. Try again tomorrow.` }), { status: 429, headers: { "Content-Type": "application/json" } });
          }
        }

        const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN;
        const replyTo = inboundDomain ? `reply+${lead.id}@${inboundDomain}` : undefined;

        const result = await sendEmail({
          to: lead.email,
          subject: draft.subject ?? "(no subject)",
          body: draft.body,
          replyTo,
        });

        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error ?? "send_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const now = new Date().toISOString();
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
