import { geminiJSON } from "~/agent/tools/gemini";
import { upsertDraft, type CampaignDraft } from "~/db/queries/drafts";
import type { CampaignStep } from "~/db/queries/steps";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";

export async function generateDraftForLead(opts: {
  campaign: Campaign;
  lead: Lead;
  step: CampaignStep;
  orgProfile: Record<string, unknown>;
}): Promise<CampaignDraft> {
  const { campaign, lead, step, orgProfile } = opts;
  const stepChannel = step.channel ?? (campaign.channel === "linkedin" ? "linkedin" : campaign.channel === "instagram" ? "instagram" : "email");
  const isFollowUp = step.stepNumber > 1;

  // Extract default signature if any
  const signatures = (orgProfile.emailSignatures ?? []) as import("~/types/signature").EmailSignature[];
  const defaultSig = signatures.find((s) => s.isDefault) ?? null;

  const productContext = [
    orgProfile.description ? `Product: ${orgProfile.description}` : null,
    orgProfile.website ? `Website: ${orgProfile.website}` : null,
    orgProfile.industry ? `Industry: ${orgProfile.industry}` : null,
    orgProfile.useCases ? `Use cases: ${orgProfile.useCases}` : null,
  ].filter(Boolean).join("\n");

  const leadContext = [
    `Company: ${lead.company}`,
    `CEO/Contact: ${lead.ceo}`,
    lead.whatTheyDo ? `What they do: ${lead.whatTheyDo}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    lead.fit ? `ICP fit: ${lead.fit}` : null,
    lead.fitReason ? `Why they're a fit: ${lead.fitReason}` : null,
    lead.score != null ? `Fit score: ${lead.score}/100` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ].filter(Boolean).join("\n");

  const followUpNote = isFollowUp
    ? `\nThis is follow-up #${step.stepNumber - 1}. They haven't replied to the previous message. Keep it short — 2-3 sentences max. Reference that you reached out before but don't be pushy. Different angle if possible.${step.context ? `\nStep context: ${step.context}` : ""}`
    : step.context ? `\nAdditional context for this step: ${step.context}` : "";

  const channelRules =
    stepChannel === "instagram"
      ? `You are writing a casual, punchy Instagram DM for cold outreach. It must feel like a real human sent it, not a marketer.
Rules:
- Tone: conversational, direct, a little bold — not corporate
- No subject line (Instagram DMs have none)
- Maximum ${isFollowUp ? "2 sentences" : "3 sentences"} — keep it tight
- Reference what their company actually does, but casually
- End with a super low-friction CTA (e.g. "Worth a chat?", "Curious to hear more?")
- Never start with "Hey!" or generic openers
- No emojis unless they feel completely natural${followUpNote}`
      : stepChannel === "linkedin"
      ? `You are a concise, direct outreach writer writing a LinkedIn DM for cold outreach.
Rules:
- Never start with filler openers
- Reference what their company does and why the product is relevant
- ${isFollowUp ? "Maximum 3 sentences for follow-ups." : "Maximum 4 sentences."}
- End with one clear, low-friction CTA
- Write as a human, not a marketer
- No subject line${followUpNote}`
      : `You are a concise, direct outreach writer writing a cold email that doesn't sound like a template.
Rules:
- Never start with "I hope this email finds you well" or any filler opener
- Reference what their company actually does and why the product is genuinely relevant
- ${isFollowUp ? "Maximum 3 sentences for follow-ups." : "Maximum 4 sentences."} Subject line under 8 words.
- End with one clear, low-friction CTA (e.g. "Open to a quick 20-min call?")
- Write as a human, not a marketer${followUpNote}`;

  const systemPrompt = `${channelRules}

Respond with JSON only: { "subject": "...", "body": "..." }
For non-email channels, set subject to null.`;

  const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}`;

  const parsed = await geminiJSON<{ subject?: string; body?: string }>(userPrompt, {
    maxTokens: 512,
    system: systemPrompt,
  });
  if (!parsed.body) throw new Error("No body in response");

  const finalBody = defaultSig && stepChannel === "email" ? `${parsed.body}\n\n${defaultSig.content}` : parsed.body;

  return upsertDraft({
    campaignId: campaign.id,
    leadId: lead.id,
    stepNumber: step.stepNumber,
    channel: stepChannel,
    subject: parsed.subject ?? null,
    body: finalBody,
  });
}
