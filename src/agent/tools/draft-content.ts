import { geminiJSON } from "~/agent/tools/gemini";
import { getLatestDraftBeforeStep, upsertDraft, type CampaignDraft } from "~/db/queries/drafts";
import type { CampaignStep } from "~/db/queries/steps";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";
import { explainProductMatch, type ProductProfile } from "~/lib/product-matching";
import { getBusinessMaterialSummary } from "~/db/queries/business-materials";

const draftResponseSchema = {
  type: "object",
  properties: {
    subject: { anyOf: [{ type: "string" }, { type: "null" }] },
    body: { type: "string" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

export async function generateDraftForLead(opts: {
  campaign: Campaign;
  lead: Lead;
  step: CampaignStep;
  orgProfile: Record<string, unknown>;
  products?: ProductProfile[];
}): Promise<CampaignDraft> {
  const { campaign, lead, step, orgProfile, products = [] } = opts;
  const rawChannel = step.channel ?? (campaign.channels[0] ?? "email");
  if (rawChannel === "reddit") {
    throw new Error("Reddit campaign publishing is not supported yet");
  }
  // Material enrichment must never prevent a user from generating a draft if
  // a legacy deployment has not yet applied the materials migration.
  const materialProfile = await getBusinessMaterialSummary(campaign.organizationId).catch(() => ({ positioning: [], terminology: [], proofPoints: [], idealCustomers: [], problemsSolved: [], voice: [] }));
  const stepChannel = rawChannel === "linkedin" && step.linkedinType === "connect"
    ? "linkedin_connect"
    : rawChannel;
  const isFollowUp = step.stepNumber > 1;
  const priorDraft = isFollowUp
    ? await getLatestDraftBeforeStep(campaign.id, lead.id, step.stepNumber)
    : null;

  // Extract default signature if any
  const signatures = (orgProfile.emailSignatures ?? []) as import("~/types/signature").EmailSignature[];
  const defaultSig = signatures.find((s) => s.isDefault) ?? null;

  const productContext = [
    orgProfile.description ? `Product: ${orgProfile.description}` : null,
    orgProfile.website ? `Website: ${orgProfile.website}` : null,
    orgProfile.industry ? `Industry: ${orgProfile.industry}` : null,
    orgProfile.useCases ? `Use cases: ${orgProfile.useCases}` : null,
    orgProfile.icp ? `Ideal customer profile: ${orgProfile.icp}` : null,
    orgProfile.messaging ? `Positioning and proof: ${orgProfile.messaging}` : null,
    materialProfile.positioning.length ? `Source-backed positioning: ${materialProfile.positioning.join(" | ")}` : null,
    materialProfile.terminology.length ? `Use this terminology where relevant: ${materialProfile.terminology.join(", ")}` : null,
    materialProfile.proofPoints.length ? `Source-backed proof: ${materialProfile.proofPoints.join(" | ")}` : null,
    (() => { try {
      const voice = typeof orgProfile.agentVoice === "string" ? JSON.parse(orgProfile.agentVoice) as { senderName?: string; senderTitle?: string; tone?: string; avoidPhrases?: string } : null;
      return voice ? [voice.senderName ? `Sender: ${voice.senderName}${voice.senderTitle ? `, ${voice.senderTitle}` : ""}` : null, voice.tone ? `Voice: ${voice.tone}` : null, voice.avoidPhrases ? `Never use: ${voice.avoidPhrases}` : null].filter(Boolean).join("\n") : null;
    } catch { return null; } })(),
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
    ? `\nThis is follow-up #${step.stepNumber - 1}. They haven't replied to the previous message. Keep it short — 2-3 sentences max. Reference that you reached out before but don't be pushy. Use a genuinely different angle, benefit, opening, and CTA.${step.context ? `\nStep context: ${step.context}` : ""}`
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
      : stepChannel === "linkedin_connect"
      ? `You are writing a LinkedIn Connection Request note for cold outreach. This is NOT a DM — it accompanies the connection request itself.
Rules:
- STRICT maximum of 300 characters total (LinkedIn's limit for connection notes)
- Do not waste characters on "Hi [name]," — get to the point immediately
- One specific reason why connecting makes sense, tied to their actual business
- No CTA beyond the implicit one of accepting the connection
- Zero filler, zero corpo-speak
- No subject line${followUpNote}`
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

  const productMatch = explainProductMatch(products, lead);
  const matchedProductContext = productMatch ? `\n\nSELECTED PRODUCT\n${productMatch.product.name}: ${productMatch.product.description}\nBenefits: ${productMatch.product.benefits.join(", ")}\nWhy it matches: ${productMatch.reason}` : "";
  const priorContext = priorDraft?.body
    ? `\n\nPREVIOUS MESSAGE — do not repeat its opening, phrasing, benefit, or CTA\n${priorDraft.body.slice(0, 1_200)}`
    : "";
  const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}${matchedProductContext}${priorContext}`;

  const parsed = await geminiJSON<{ subject: string | null; body: string }>(userPrompt, {
    maxTokens: 512,
    system: systemPrompt,
    responseJsonSchema: draftResponseSchema,
  });
  if (!parsed.body) throw new Error("No body in response");

  const finalBody = defaultSig && stepChannel === "email" ? `${parsed.body}\n\n${defaultSig.content}` : parsed.body;

  return upsertDraft({
    campaignId: campaign.id,
    leadId: lead.id,
    stepNumber: step.stepNumber,
    channel: stepChannel,
    subject: stepChannel === "email" ? parsed.subject ?? null : null,
    body: finalBody,
    generationContext: { company: lead.company, contact: lead.ceo, whatTheyDo: lead.whatTheyDo, fitReason: lead.fitReason, score: lead.score, campaignGoal: campaign.goal, stepContext: step.context, selectedProduct: productMatch?.product.name ?? null, productMatchReason: productMatch?.reason ?? null, productMatchTerms: productMatch?.matchedTerms ?? [], previousDraftId: priorDraft?.id ?? null },
  });
}
