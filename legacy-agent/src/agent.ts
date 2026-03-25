import Anthropic from '@anthropic-ai/sdk';
import { readPipelineSummary, addLead, updateLead } from './tools/pipeline.js';
import { sendEmail } from './tools/email.js';
import { notifySlack } from './tools/slack.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are the Head of Marketing for MailBridge (usemailbridge.com). You operate autonomously as a world-class B2B outreach expert.

ABOUT MAILBRIDGE:
MailBridge routes customer support emails into Slack and Discord with AI triage. When a customer emails in, the AI reads it, categorises it (billing, bug, question, complaint, etc.), assigns a priority, and posts a summary to the right Slack or Discord channel. The team replies from Slack/Discord and the customer gets a normal email reply. Plans start at $19/month. 10-day free trial, no credit card required.

YOUR MISSION:
Get 10 paying customers signed up. Focus on direct, personal outreach to African startups.

IDEAL CUSTOMER PROFILE:
- B2B SaaS, fintech, payments, logistics, e-commerce, or any company with customer-facing email support
- 1 to 200 person teams globally. Solo founders and small teams feel the pain hardest. Do NOT filter by team size unless clearly enterprise (500+ employees)
- Geography: global. US, Europe, Latin America, Southeast Asia, Africa — anywhere. Do not limit to Africa. African markets are valid but should not be the primary focus
- Communication tools: Slack and Discord are the primary targets but do not exclude teams on other tools. MailBridge has webhooks so it can push to any system. If a company wants the product but uses a different tool, that is fine — we can work with them
- Already have customer email volume: support@, help@, billing questions, onboarding, bug reports
- Key signal: small team, growing product, starting to feel overwhelmed by support email

OUTREACH RULES:
1. Never send more than one email per person per 3 days
2. Always personalise each email. Know what they do and name one specific pain they likely feel
3. No em-dashes in any written content. Use short, human sentences
4. After email is sent, wait 3 days then notify Evans via Slack to follow up on LinkedIn
5. Track every action in the pipeline immediately after taking it
6. Always notify Slack after taking any meaningful action so Evans is in the loop
7. HIGH fit leads get contacted first. LOW fit leads only if pipeline is thin

EMAIL FORMAT (use this structure always):
Hi [Name],

I'm Evans. I'm building MailBridge.

It helps teams route customer feedback from support emails into tools like Slack, Discord, or their PM workflows, so nothing slips through the cracks.

I saw [one specific thing about their company]. I imagine [one specific pain point they experience].

Curious, is handling support emails starting to become a bottleneck?

If it is, I'd be happy to show you what we're building. It'll take 15 minutes.

Evans
Founder, MailBridge
usemailbridge.com

SCHEDULED RUN BEHAVIOUR (when prompt says "daily run"):
1. Read the pipeline
2. Identify leads where email was sent 3+ days ago with no reply. Notify Evans on Slack to send them a LinkedIn message, and include a drafted LinkedIn message
3. Look for any leads with status "not_contacted" and send them an outreach email
4. If total leads in pipeline is under 20, use web_search to find 2 to 3 new relevant companies and add them to the pipeline. Use a wide net:
   - Search global startup directories: YC (all batches), Product Hunt launches, Indie Hackers, BetaList
   - Search Reddit for posts like "who is building X", "looking for a tool that does", "support emails are overwhelming", "drowning in customer emails", "missed a support email" in r/startups, r/SaaS, r/Entrepreneur, r/indiehackers, r/smallbusiness
   - Search LinkedIn and Twitter/X for founders posting about customer support pain or inbox chaos
   - Search for YC-backed companies from recent batches (W24, S24, W25) that are early stage
   - Search for bootstrapped SaaS companies on Indie Hackers with growing customer bases
   - Search globally: US, Europe, Latin America, Southeast Asia are all good markets
5. Send a morning summary to Slack: emails sent today, follow-ups due, new leads added, pipeline stats

CURRENT DATE: ${new Date().toISOString()}`;

const USER_TOOLS = [
  {
    name: 'read_pipeline',
    description: 'Read the current outreach pipeline with all leads and their status, email dates, and notes.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_lead',
    description: 'Add a new company to the outreach pipeline. Only add leads you have verified through web_search.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name' },
        website: { type: 'string', description: 'Company website URL' },
        whatTheyDo: { type: 'string', description: 'One sentence description of what they do' },
        ceo: { type: 'string', description: 'CEO or founder name' },
        email: { type: 'string', description: 'CEO email address' },
        linkedin: { type: 'string', description: 'CEO LinkedIn URL if found' },
        fit: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'ICP fit rating' },
        notes: { type: 'string', description: 'Why this company is a good fit for MailBridge' },
      },
      required: ['company', 'ceo', 'email', 'fit'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update a lead status or add notes after an action (email sent, reply received, not interested, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead ID from read_pipeline' },
        status: {
          type: 'string',
          enum: ['not_contacted', 'email_sent', 'linkedin_sent', 'replied', 'call_scheduled', 'converted', 'not_interested'],
        },
        notes: { type: 'string', description: 'Notes to append' },
        emailSentAt: { type: 'string', description: 'ISO date when email was sent' },
        linkedinSentAt: { type: 'string', description: 'ISO date when LinkedIn message was sent' },
        repliedAt: { type: 'string', description: 'ISO date when they replied' },
      },
      required: ['id'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an outreach or follow-up email to a lead via Zoho SMTP.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Plain text email body. Follow the email format in your instructions.' },
        leadId: { type: 'string', description: 'Lead ID to auto-update status to email_sent after sending' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'notify_slack',
    description: 'Send a message to Evans on the MailBridge Slack monitoring channel. Use this to share summaries, flag follow-ups needed, or report what you just did.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to send. Use plain text, no markdown formatting.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'get_current_date',
    description: 'Get the current date and time in ISO format.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'read_pipeline': {
        return await readPipelineSummary();
      }
      case 'add_lead': {
        const lead = await addLead(input as Parameters<typeof addLead>[0]);
        return JSON.stringify({ success: true, lead });
      }
      case 'update_lead': {
        const { id, ...updates } = input as { id: string } & Record<string, unknown>;
        const lead = await updateLead(id, updates as Parameters<typeof updateLead>[1]);
        return JSON.stringify({ success: true, lead });
      }
      case 'send_email': {
        const result = await sendEmail({
          to: input.to as string,
          subject: input.subject as string,
          body: input.body as string,
        });
        if (result.success && input.leadId) {
          await updateLead(input.leadId as string, {
            status: 'email_sent',
            emailSentAt: new Date().toISOString(),
          });
        }
        return JSON.stringify(result);
      }
      case 'notify_slack': {
        const result = await notifySlack(input.message as string);
        return JSON.stringify(result);
      }
      case 'get_current_date': {
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

export async function runAgent(prompt: string): Promise<void> {
  console.log(`\n[Agent] Running: ${prompt}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

  const allTools = [
    ...USER_TOOLS,
    { type: 'web_search_20260209' as const, name: 'web_search' as const },
  ];

  let iterations = 0;
  const maxIterations = 30;
  let containerId: string | undefined;

  while (iterations < maxIterations) {
    iterations++;

    const requestParams: Record<string, unknown> = {
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: allTools as Anthropic.Messages.ToolUnion[],
      messages,
    };
    if (containerId) requestParams.container = containerId;

    const response = await client.messages.create(
      requestParams as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    // Track container_id for web_search dynamic filtering (code execution under the hood)
    const responseAny = response as unknown as Record<string, unknown>;
    if (responseAny.container && typeof responseAny.container === 'object') {
      containerId = (responseAny.container as { id: string }).id;
    }

    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`[Agent] ${block.text}`);
      }
    }

    const stopReason = response.stop_reason as string;

    if (stopReason === 'end_turn') {
      console.log('[Agent] Done.\n');
      break;
    }

    if (stopReason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    if (stopReason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`[Tool] ${block.name}`);
          const result = await executeTool(block.name, block.input as Record<string, unknown>);
          console.log(`[Tool Result] ${result.slice(0, 300)}\n`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    // Keep conversation history lean: preserve first message + last 10 exchanges
    if (messages.length > 21) {
      messages.splice(1, messages.length - 21);
    }

    // Delay to stay under rate limits
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (iterations >= maxIterations) {
    console.warn('[Agent] Hit max iterations limit.');
  }
}
