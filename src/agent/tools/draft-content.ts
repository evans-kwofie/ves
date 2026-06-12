import Anthropic from "@anthropic-ai/sdk";
import { upsertDraft, type CampaignDraft } from "~/db/queries/drafts";
import type { CampaignStep } from "~/db/queries/steps";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateDraftForLead(opts: {
  campaign: Campaign;
  lead: Lead;
  step: CampaignStep;
  orgProfile: Record<string, unknown>;
}): Promise<CampaignDraft> {
  const { campaign, lead, step, orgProfile } = opts;
  const stepChannel = step.channel ?? (campaign.channel === "linkedin" ? "linkedin" : "email");
  const isFollowUp = step.stepNumber > 1;
  console.log(`[draft-content] generating for lead=${lead.id} company="${lead.company}" step=${step.stepNumber} channel=${stepChannel} isFollowUp=${isFollowUp}`);

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

  const systemPrompt = `You are a concise, direct outreach writer. Your job is to write a highly personalised cold ${stepChannel === "email" ? "email" : "LinkedIn message"} that doesn't sound like a template.

Rules:
- Never start with "I hope this email finds you well" or any filler opener
- Do not mention their LinkedIn post, job title, or other superficial signals
- Reference what their company actually does and why the product is genuinely relevant to them
- ${isFollowUp ? "Maximum 3 sentences for follow-ups." : "Maximum 4 sentences."} Subject line under 8 words.
- End with one clear, low-friction CTA (e.g. "Open to a quick 20-min call?")
- Write as a human, not a marketer${followUpNote}

Respond with JSON only: { "subject": "...", "body": "..." }`;

  const userPrompt = `${productContext ? `OUR PRODUCT\n${productContext}\n\n` : ""}LEAD\n${leadContext}${campaign.goal ? `\n\nCAMPAIGN GOAL\n${campaign.goal}` : ""}`;

  console.log(`[draft-content] calling Claude API for lead=${lead.id}`);
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  console.log(`[draft-content] Claude raw response for lead=${lead.id}:`, text.slice(0, 200));
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[draft-content] no JSON found in response for lead=${lead.id}`);
    throw new Error("No JSON in response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as { subject?: string; body?: string };
  if (!parsed.body) {
    console.error(`[draft-content] no body in parsed JSON for lead=${lead.id}:`, parsed);
    throw new Error("No body in response");
  }

  const finalBody = defaultSig ? `${parsed.body}\n\n${defaultSig.content}` : parsed.body;
  if (defaultSig) console.log(`[draft-content] appending default signature "${defaultSig.name}"`);

  console.log(`[draft-content] upserting draft for lead=${lead.id} subject="${parsed.subject ?? "none"}"`);
  return upsertDraft({
    campaignId: campaign.id,
    leadId: lead.id,
    stepNumber: step.stepNumber,
    channel: stepChannel,
    subject: parsed.subject ?? null,
    body: finalBody,
  });
}
