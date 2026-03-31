import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { readPipelineSummary, addLead, updateLead } from "./tools/pipeline";
import { sendEmail } from "./tools/email";
import { notifySlack } from "./tools/slack";
import { buildSystemPrompt } from "./prompts";
import { createOutreachEvent } from "~/db/queries/leads";
import type { AgentVoiceConfig } from "~/routes/$workspaceId/settings/agent";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
});

const USER_TOOLS = [
  {
    name: "read_pipeline",
    description: "Read the current outreach pipeline with all leads and their status, email dates, and notes.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_lead",
    description: "Add a new company to the outreach pipeline. Only add leads you have verified through web_search.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name" },
        website: { type: "string", description: "Company website URL" },
        whatTheyDo: { type: "string", description: "One sentence description of what they do" },
        ceo: { type: "string", description: "CEO or founder name" },
        email: { type: "string", description: "CEO email address" },
        linkedin: { type: "string", description: "CEO LinkedIn URL if found" },
        fit: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"], description: "ICP fit rating" },
        notes: { type: "string", description: "Why this company is a good fit for MailBridge" },
      },
      required: ["company", "ceo", "email", "fit"],
    },
  },
  {
    name: "update_lead",
    description: "Update a lead status or add notes after an action (email sent, reply received, not interested, etc.)",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Lead ID from read_pipeline" },
        status: {
          type: "string",
          enum: ["not_contacted", "email_sent", "linkedin_sent", "replied", "call_scheduled", "converted", "not_interested"],
        },
        notes: { type: "string", description: "Notes to append" },
        emailSentAt: { type: "string", description: "ISO date when email was sent" },
        linkedinSentAt: { type: "string", description: "ISO date when LinkedIn message was sent" },
        repliedAt: { type: "string", description: "ISO date when they replied" },
      },
      required: ["id"],
    },
  },
  {
    name: "send_email",
    description: "Send an outreach or follow-up email to a lead via Zoho SMTP.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Plain text email body. Follow the email format in your instructions." },
        leadId: { type: "string", description: "Lead ID to auto-update status to email_sent after sending" },
        campaignId: { type: "string", description: "Campaign ID to tag this outreach event against. Always include when running a campaign." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "notify_slack",
    description: "Send a message to Evans on the MailBridge Slack monitoring channel. Use this to share summaries, flag follow-ups needed, or report what you just did.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to send. Use plain text, no markdown formatting." },
      },
      required: ["message"],
    },
  },
  {
    name: "get_current_date",
    description: "Get the current date and time in ISO format.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

async function executeTool(name: string, input: Record<string, unknown>, orgId: string): Promise<string> {
  try {
    switch (name) {
      case "read_pipeline": {
        return await readPipelineSummary(orgId);
      }
      case "add_lead": {
        const lead = await addLead(orgId, input as Parameters<typeof addLead>[1]);
        return JSON.stringify({ success: true, lead });
      }
      case "update_lead": {
        const { id, ...updates } = input as { id: string } & Record<string, unknown>;
        const lead = await updateLead(id, updates as Parameters<typeof updateLead>[1]);
        return JSON.stringify({ success: true, lead });
      }
      case "send_email": {
        const result = await sendEmail({
          to: input.to as string,
          subject: input.subject as string,
          body: input.body as string,
        });
        if (result.success && input.leadId) {
          const now = new Date().toISOString();
          await updateLead(input.leadId as string, {
            status: "email_sent",
            emailSentAt: now,
          });
          await createOutreachEvent({
            leadId: input.leadId as string,
            channel: "email",
            status: "email_sent",
            sentAt: now,
            campaignId: (input.campaignId as string | undefined) ?? null,
          });
        }
        return JSON.stringify(result);
      }
      case "notify_slack": {
        const result = await notifySlack(input.message as string);
        return JSON.stringify(result);
      }
      case "get_current_date": {
        return new Date().toISOString();
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ success: false, error });
  }
}

export async function runAgent(
  prompt: string,
  opts?: { maxIterations?: number; orgId?: string; voice?: Partial<AgentVoiceConfig> },
): Promise<string[]> {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    console.log(line);
  };

  const orgId = opts?.orgId ?? "";
  log(`\n[Agent] Running: ${prompt}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  const allTools = [
    ...USER_TOOLS,
    { type: "web_search_20260209" as const, name: "web_search" as const },
  ];

  let iterations = 0;
  const maxIterations = opts?.maxIterations ?? 30;
  let containerId: string | undefined;

  while (iterations < maxIterations) {
    iterations++;

    const requestParams: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: buildSystemPrompt(opts?.voice),
      tools: allTools as Anthropic.Messages.ToolUnion[],
      messages,
    };
    if (containerId) requestParams.container = containerId;

    const response = await client.messages.create(
      requestParams as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const responseAny = response as unknown as Record<string, unknown>;
    if (responseAny.container && typeof responseAny.container === "object") {
      containerId = (responseAny.container as { id: string }).id;
    }

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        log(`[Agent] ${block.text}`);
      }
    }

    const stopReason = response.stop_reason as string;

    if (stopReason === "end_turn") {
      log("[Agent] Done.\n");
      break;
    }

    if (stopReason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (stopReason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          log(`[Tool] ${block.name}`);
          const result = await executeTool(block.name, block.input as Record<string, unknown>, orgId);
          log(`[Tool Result] ${result.slice(0, 300)}\n`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    if (messages.length > 21) {
      messages.splice(1, messages.length - 21);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (iterations >= maxIterations) {
    log("[Agent] Hit max iterations limit.");
  }

  return logs;
}
