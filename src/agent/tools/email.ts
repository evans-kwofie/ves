import nodemailer from 'nodemailer';
import type { SmtpConfig } from '~/types/smtp';

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

function createTransport(config?: Partial<SmtpConfig>) {
  return nodemailer.createTransport({
    host: config?.host || process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
    port: config?.port || Number(process.env.ZOHO_SMTP_PORT ?? 587),
    secure: config?.secure ?? false,
    auth: {
      user: config?.user || process.env.ZOHO_SMTP_USER,
      pass: config?.pass || process.env.ZOHO_SMTP_PASS,
    },
  });
}

function getFromName(config?: Partial<SmtpConfig>) {
  return config?.fromName || process.env.AGENT_FROM_NAME || 'Vesper Agent';
}

function getFromEmail(config?: Partial<SmtpConfig>) {
  return config?.user || process.env.ZOHO_SMTP_USER || '';
}

export async function sendEmail(
  input: SendEmailInput,
  smtpConfig?: Partial<SmtpConfig>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = createTransport(smtpConfig);
    const info = await transport.sendMail({
      from: `"${getFromName(smtpConfig)}" <${getFromEmail(smtpConfig)}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    console.log(`[Email] Sent to ${input.to} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Failed to send to ${input.to}: ${error}`);
    return { success: false, error };
  }
}
