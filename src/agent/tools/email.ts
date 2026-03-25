import nodemailer from 'nodemailer';

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST ?? 'smtp.zoho.com',
    port: Number(process.env.ZOHO_SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASS,
    },
  });
}

export async function sendEmail(input: SendEmailInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = createTransport();
    const info = await transport.sendMail({
      from: `"${process.env.AGENT_FROM_NAME ?? 'Evans Kwofie'}" <${process.env.ZOHO_SMTP_USER}>`,
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
