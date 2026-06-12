import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const from = process.env.EMAIL_FROM ?? "Vesper <onboarding@resend.dev>";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (error) {
      console.error(`[Email] Resend error sending to ${input.to}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent to ${input.to} — ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Failed to send to ${input.to}: ${error}`);
    return { success: false, error };
  }
}
