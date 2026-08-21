import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { readPipelineSummary, addLead, updateLead } from "./tools/pipeline";
import { sendEmail } from "./tools/email";
import { notifySlack } from "./tools/slack";
import { buildSystemPrompt } from "./prompts";
import { createOutreachEvent } from "~/db/queries/leads";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_MODEL = "gemini-2.5-flash";

const FUNCTION_DECLARATIONS = [
  {
    name: "read_pipeline",
    description: "Read the current outreach pipeline with all leads and their status, email dates, and notes.",
    parameters: { type: "OBJECT", properties: {}, required: [] },
  },
  {
    name: "add_lead",
    description: "Add a new company to the outreach pipeline. Only add leads you have verified through web search.",
    parameters: {
      type: "OBJECT",
      properties: {
        company: { type: "STRING", description: "Company name" },
        website: { type: "STRING", description: "Company website URL" },
        whatTheyDo: { type: "STRING", description: "One sentence description of what they do" },
        ceo: { type: "STRING", description: "CEO or founder name" },
        email: { type: "STRING", description: "CEO email address" },
        linkedin: { type: "STRING", description: "CEO LinkedIn URL if found" },
        fit: { type: "STRING", description: "ICP fit rating: HIGH, MEDIUM, or LOW" },
        notes: { type: "STRING", description: "Why this company is a good fit" },
      },
      required: ["company", "ceo", "email", "fit"],
    },
  },
  {
    name: "update_lead",
    description: "Update a lead status or add notes after an action (email sent, reply received, not interested, etc.)",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING", description: "Lead ID from read_pipeline" },
        status: { type: "STRING", description: "New status" },
        notes: { type: "STRING", description: "Notes to append" },
        emailSentAt: { type: "STRING", description: "ISO date when email was sent" },
        linkedinSentAt: { type: "STRING", description: "ISO date when LinkedIn message was sent" },
        repliedAt: { type: "STRING", description: "ISO date when they replied" },
      },
      required: ["id"],
    },
  },
  {
    name: "send_email",
    description: "Send an outreach or follow-up email to a lead via Zoho SMTP.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: { type: "STRING", description: "Recipient email address" },
        subject: { type: "STRING", description: "Email subject line" },
        body: { type: "STRING", description: "Plain text email body." },
        leadId: { type: "STRING", description: "Lead ID to auto-update status to email_sent after sending" },
        campaignId: { type: "STRING", description: "Campaign ID to tag this outreach event against." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "notify_slack",
    description: "Send a message to Evans on the MailBridge Slack monitoring channel.",
    parameters: {
      type: "OBJECT",
      properties: {
        message: { type: "STRING", description: "Message to send. Use plain text, no markdown formatting." },
      },
      required: ["message"],
    },
  },
  {
    name: "get_current_date",
    description: "Get the current date and time in ISO format.",
    parameters: { type: "OBJECT", properties: {}, required: [] },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, orgId: string): Promise<string> {
  try {
    switch (name) {
      case "read_pipeline":
        return await readPipelineSummary(orgId);
      case "add_lead": {
        const lead = await addLead(orgId, args as Parameters<typeof addLead>[1]);
        return JSON.stringify({ success: true, lead });
      }
      case "update_lead": {
        const { id, ...updates } = args as { id: string } & Record<string, unknown>;
        const lead = await updateLead(id, updates as Parameters<typeof updateLead>[1]);
        return JSON.stringify({ success: true, lead });
      }
      case "send_email": {
        const result = await sendEmail({
          to: args.to as string,
          subject: args.subject as string,
          body: args.body as string,
        });
        if (result.success && args.leadId) {
          const now = new Date().toISOString();
          await updateLead(args.leadId as string, { status: "email_sent", emailSentAt: now });
          await createOutreachEvent({
            leadId: args.leadId as string,
            channel: "email",
            status: "email_sent",
            sentAt: now,
            campaignId: (args.campaignId as string | undefined) ?? null,
          });
        }
        return JSON.stringify(result);
      }
      case "notify_slack":
        return JSON.stringify(await notifySlack(args.message as string));
      case "get_current_date":
        return new Date().toISOString();
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function runAgent(
  prompt: string,
  opts?: { maxIterations?: number; orgId?: string; voice?: Partial<AgentVoiceConfig>; allowedTools?: string[] },
): Promise<string[]> {
  const logs: string[] = [];
  const log = (line: string) => { logs.push(line); console.log(line); };

  const orgId = opts?.orgId ?? "";
  log(`\n[Agent] Running: ${prompt}\n`);

  const contents: { role: string; parts: unknown[] }[] = [
    { role: "user", parts: [{ text: prompt }] },
  ];

  let iterations = 0;
  const maxIterations = opts?.maxIterations ?? 30;

  while (iterations < maxIterations) {
    iterations++;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: contents as never,
      config: {
        systemInstruction: buildSystemPrompt(opts?.voice),
        tools: [
          { functionDeclarations: FUNCTION_DECLARATIONS.filter((tool) => !opts?.allowedTools || opts.allowedTools.includes(tool.name)) as never },
          { googleSearch: {} },
        ],
        maxOutputTokens: 8192,
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) break;

    const parts = candidate.content?.parts ?? [];
    contents.push({ role: "model", parts });

    let hasText = false;
    const functionCalls: { name: string; args: Record<string, unknown> }[] = [];

    for (const part of parts) {
      const p = part as Record<string, unknown>;
      if (p.text && typeof p.text === "string" && p.text.trim()) {
        log(`[Agent] ${p.text}`);
        hasText = true;
      }
      if (p.functionCall && typeof p.functionCall === "object") {
        const fc = p.functionCall as { name: string; args: Record<string, unknown> };
        functionCalls.push(fc);
      }
    }

    if (functionCalls.length === 0) {
      if (hasText) log("[Agent] Done.\n");
      break;
    }

    const resultParts: unknown[] = [];
    for (const fc of functionCalls) {
      log(`[Tool] ${fc.name}`);
      const result = await executeTool(fc.name, fc.args ?? {}, orgId);
      log(`[Tool Result] ${result.slice(0, 300)}\n`);
      resultParts.push({
        functionResponse: { name: fc.name, response: { result } },
      });
    }

    contents.push({ role: "user", parts: resultParts });

    if (contents.length > 42) {
      contents.splice(1, contents.length - 42);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (iterations >= maxIterations) {
    log("[Agent] Hit max iterations limit.");
  }

  return logs;
}
