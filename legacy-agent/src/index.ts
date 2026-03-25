import 'dotenv/config';
import cron from 'node-cron';
import * as readline from 'readline';
import { runAgent } from './agent.js';

const DAILY_PROMPT = `This is your daily scheduled run. Do the following in order:
1. Read the pipeline and assess the current state
2. Identify any leads where the email was sent 3 or more days ago with no reply. Draft a LinkedIn follow-up message for each and notify Evans on Slack with the drafted message so he can send it manually
3. Send outreach emails to any leads with status "not_contacted", starting with HIGH fit leads
4. If total leads in the pipeline is under 20, search the web to find 2 to 3 new relevant companies and add them to the pipeline
5. Send a morning summary to Slack with what you did, what is pending, and the current pipeline stats`;

async function runScheduled() {
  console.log(`[Scheduler] Daily run triggered at ${new Date().toISOString()}`);
  await runAgent(DAILY_PROMPT);
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nMailBridge Marketing Agent');
  console.log('Type your prompt and press Enter. Type "exit" to quit.\n');

  const ask = () => {
    rl.question('You: ', async (input) => {
      const prompt = input.trim();
      if (!prompt || prompt === 'exit') {
        rl.close();
        return;
      }
      await runAgent(prompt);
      ask();
    });
  };

  ask();
}

async function main() {
  const args = process.argv.slice(2);
  const isPromptMode = args.includes('--prompt');

  if (isPromptMode) {
    await runInteractive();
    return;
  }

  // Scheduled mode: run daily at 8 AM
  console.log('[Scheduler] Marketing agent started. Daily run scheduled at 8:00 AM.');
  console.log('[Scheduler] Running initial check now...\n');

  // Run once on startup
  await runAgent(DAILY_PROMPT);

  // Then schedule daily at 8 AM
  cron.schedule('0 8 * * *', runScheduled, {
    timezone: 'Africa/Accra',
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
