import axios from 'axios';

export async function notifySlack(message: string): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Slack] SLACK_WEBHOOK_URL not set — skipping notification');
    return { success: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  try {
    await axios.post(webhookUrl, { text: `*[Marketing Agent]* ${message}` });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Slack] Failed to notify: ${error}`);
    return { success: false, error };
  }
}
