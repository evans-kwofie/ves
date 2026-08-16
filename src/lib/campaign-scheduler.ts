import { listCampaignsDueToRun, getCampaignLeadsWithData, updateCampaignLastRun } from "~/db/queries/campaigns";
import { upsertDraft } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import { getTemplate } from "~/db/queries/templates";
import { db } from "~/db/client";
import type { Lead } from "~/types/lead";
import type { CampaignIntent } from "~/types/campaign";
import { geminiJSON } from "~/agent/tools/gemini";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let started = false;

async function getOrgProfile(orgId: string): Promise<Record<string, string>> {
  try {
    const result = await db.execute({
      sql: "SELECT metadata FROM organization WHERE id = ?",
      args: [orgId],
    });
    if (result.rows.length === 0) return {};
    const raw = (result.rows[0] as Record<string, unknown>).metadata;
    if (!raw) return {};
    return JSON.parse(raw as string) as Record<string, string>;
  } catch {
    return {};
  }
}

function buildSystemPrompt(channel: string, intentType: CampaignIntent | null): string {
  const isEmail = channel === "email";

  if (channel === "linkedin_connect") {
    return `You are writing a LinkedIn connection request note from a founder to a potential customer.

Rules:
- HARD LIMIT: 300 characters total
- One sentence about something specific to THEIR work — show you looked them up
- One sentence on why you want to connect — brief, genuine, no pitch
- No CTA beyond connecting
- No filler phrases like "I'd love to connect"

Return JSON: { "subject": null, "body": "connection note under 300 chars" }`;
  }

  const intent = intentType ?? "advice_seeking";
  const medium = isEmail ? "email" : "LinkedIn DM";
  const subjectRule = isEmail ? "\n- Subject line: 6 words max, specific to them — not generic" : "";
  const jsonShape = `{ "subject": ${isEmail ? '"short subject"' : "null"}, "body": "message" }`;

  if (intent === "advice_seeking") {
    return `You are a founder writing a personal, concise outreach ${medium} to a potential early customer. Your goal is to get their advice or perspective.

Rules:
- Open with something specific about what THEY do — show you looked them up
- Ask for their feedback, opinion, or experience — not a demo, not a sale
- Under 75 words total.${subjectRule}
- One CTA only: low-friction — "would love your take if you have 10 minutes"

Return JSON: ${jsonShape}`;
  }

  if (intent === "product_review") {
    return `You are a founder writing a personal outreach ${medium} asking someone to try your product and give honest feedback.

Rules:
- Start with something specific about what THEY do
- Offer to let them try it free, no commitment required
- Under 75 words total.${subjectRule}
- One CTA only: "would you be up for trying it and telling me what you think?"

Return JSON: ${jsonShape}`;
  }

  if (intent === "audit_offer") {
    return `You are a founder writing a personal outreach ${medium} leading with a free, specific audit as an upfront gift.

Rules:
- Open by naming something concrete about their business you noticed
- Offer the audit for free, no strings
- Under 75 words total.${subjectRule}
- One CTA only: "want me to run this for you?"

Return JSON: ${jsonShape}`;
  }

  return `You are a founder writing a direct, concise outreach ${medium} with a clear value prop and a demo ask.

Rules:
- Open with something specific about their business
- State the core outcome your product delivers in one sentence
- Under 75 words total.${subjectRule}
- One CTA only: "would you be open to a 20-min demo?"

Return JSON: ${jsonShape}`;
}

function resolveTokens(text: string, lead: Lead): string {
  const parts = (lead.ceo ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return text
    .replaceAll("{{firstName}}", firstName)
    .replaceAll("{{lastName}}", lastName)
    .replaceAll("{{fullName}}", lead.ceo ?? "")
    .replaceAll("{{company}}", lead.company ?? "")
    .replaceAll("{{website}}", lead.website ?? "")
    .replaceAll("{{whatTheyDo}}", lead.whatTheyDo ?? "");
}

async function tick() {
  try {
    const dueCampaigns = await listCampaignsDueToRun();
    if (dueCampaigns.length === 0) return;

    console.log(`[campaign-scheduler] ${dueCampaigns.length} campaign(s) due`);

    for (const campaign of dueCampaigns) {
      try {
        const [leads, steps, orgProfile] = await Promise.all([
          getCampaignLeadsWithData(campaign.id),
          listSteps(campaign.id),
          getOrgProfile(campaign.organizationId),
        ]);

        if (leads.length === 0) continue;

        const activeSteps = steps.length > 0
          ? steps
          : [{ stepNumber: 1, channel: campaign.channels[0] ?? "email", context: null, delayDays: 0, templateId: null, id: "", campaignId: campaign.id, createdAt: "" }];

        const productContext = [
          orgProfile.description ? `Product: ${orgProfile.description}` : null,
          orgProfile.website ? `Website: ${orgProfile.website}` : null,
          orgProfile.industry ? `Industry: ${orgProfile.industry}` : null,
          orgProfile.useCases ? `Use cases: ${orgProfile.useCases}` : null,
        ].filter(Boolean).join("\n");

        for (const step of activeSteps) {
          const channel = step.channel ?? "email";
          const isFollowUp = step.stepNumber > 1;

          let template = null;
          if (step.templateId) {
            template = await getTemplate(step.templateId).catch(() => null);
          }
          const hasVariantB = !!(template?.variantBBody);

          for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            if (lead.repliedAt) continue;

            const abVariant: "a" | "b" = hasVariantB && i % 2 === 1 ? "b" : "a";

            try {
              let subject: string | null;
              let body: string;

              if (template) {
                const useB = abVariant === "b" && hasVariantB;
                const rawSubject = useB ? (template.variantBSubject ?? template.subject) : template.subject;
                const rawBody = useB ? (template.variantBBody ?? template.body) : template.body;
                subject = rawSubject ? resolveTokens(rawSubject, lead) : null;
                body = resolveTokens(rawBody, lead);
              } else {
                const systemPrompt = buildSystemPrompt(channel, campaign.intentType);

                const leadContext = [
                  `Company: ${lead.company}`,
                  `CEO/Contact: ${lead.ceo}`,
                  lead.whatTheyDo ? `What they do: ${lead.whatTheyDo}` : null,
                  lead.website ? `Website: ${lead.website}` : null,
                  lead.fit ? `ICP fit: ${lead.fit}` : null,
                  lead.fitReason ? `Why they're a fit: ${lead.fitReason}` : null,
                  lead.score != null ? `Fit score: ${lead.score}/100` : null,
                ].filter(Boolean).join("\n");

                const followUpPrefix = isFollowUp
                  ? `You are writing a short, human follow-up ${channel === "email" ? "email" : "LinkedIn DM"} from a founder to a prospect who didn't reply.\n\nRules:\n- Acknowledge you reached out before — casually, not apologetically\n- One new angle; don't repeat yourself\n- Under 50 words. CTA: softer than the first.\n\nReturn JSON: { "subject": ${channel === "email" ? '"short subject"' : "null"}, "body": "message" }`
                  : null;

                const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}${"context" in step && step.context ? `\n\nSTEP CONTEXT\n${step.context}` : ""}`;

                const parsed = await geminiJSON<{ subject?: string | null; body?: string }>(userPrompt, {
                  maxTokens: 1024,
                  system: followUpPrefix ?? systemPrompt,
                });

                subject = parsed.subject ?? null;
                body = parsed.body ?? "";
              }

              if (!body) continue;

              await upsertDraft({
                campaignId: campaign.id,
                leadId: lead.id,
                channel,
                subject,
                body,
                stepNumber: step.stepNumber,
                abVariant,
              });
            } catch (err) {
              console.error(`[campaign-scheduler] Draft failed: campaign=${campaign.id} step=${step.stepNumber} lead=${lead.id}`, err);
            }
          }
        }

        await updateCampaignLastRun(campaign.id);
        console.log(`[campaign-scheduler] Done: campaign=${campaign.id} (${campaign.name})`);
      } catch (err) {
        console.error(`[campaign-scheduler] Campaign failed: ${campaign.id}`, err);
      }
    }
  } catch (err) {
    console.error("[campaign-scheduler] tick error:", err);
  }
}

export function startCampaignScheduler() {
  if (started) return;
  started = true;

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), INTERVAL_MS);
  }, 45_000); // 45s after startup so DB is fully ready

  console.log("[campaign-scheduler] Started — runs every hour");
}
