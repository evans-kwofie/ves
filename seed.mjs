/**
 * Demo data seed for nextreach/ves
 * Run: node --env-file=.env seed.mjs
 */
import postgres from "postgres";
import { randomUUID } from "crypto";

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/vesper");

const ORG = "H9xK8M1v1LtOAaInJ1YAmTBEKYsD1W1z";
const C_Q2  = "9a6187bf-005d-41ed-b553-d706e3c7307b";  // Q2 SaaS Founder Outreach
const C_CAP = "c2d524f1-462f-4dbc-b312-a668f05238a8";  // Capture Newest
const C_AI  = "9d2b12b5-c49f-43a0-826a-afb4809a4010";  // AI Companies
const KW1   = "03a34a09-d5e2-447a-9f4c-aa189955629c";  // scalable email solution

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n, hourJitter = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - Math.floor(Math.random() * hourJitter));
  return d.toISOString();
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function maybe(prob) { return Math.random() < prob; }
function between(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

// ── Company data ─────────────────────────────────────────────────────────────
const COMPANIES = [
  // reddit source (40)
  { c:"Sendloop",n:"Alex Rivera",e:"alex@sendloop.io",s:"reddit",fit:"HIGH",score:88,st:"email_sent",day:0 },
  { c:"MailPilot HQ",n:"Jamie Chen",e:"jamie@mailpilothq.com",s:"reddit",fit:"HIGH",score:91,st:"replied",day:0 },
  { c:"FlowMatic",n:"Sam Patel",e:"sam@flowmatic.co",s:"reddit",fit:"MEDIUM",score:72,st:"email_sent",day:0 },
  { c:"NurtureWave",n:"Priya Singh",e:"priya@nurturewave.io",s:"reddit",fit:"HIGH",score:86,st:"replied",day:0 },
  { c:"GridSync",n:"Tom Baker",e:"tom@gridsync.dev",s:"reddit",fit:"MEDIUM",score:68,st:"email_sent",day:1 },
  { c:"ChurnFix",n:"Lisa Wong",e:"lisa@churnfix.io",s:"reddit",fit:"HIGH",score:92,st:"converted",day:1 },
  { c:"LoopCraft",n:"Omar Hassan",e:"omar@loopcraft.io",s:"reddit",fit:"HIGH",score:85,st:"replied",day:1 },
  { c:"PingMe CRM",n:"Nina Johansson",e:"nina@pingmecrm.com",s:"reddit",fit:"MEDIUM",score:74,st:"email_sent",day:1 },
  { c:"CloudForms",n:"Dev Kumar",e:"dev@cloudforms.io",s:"reddit",fit:"LOW",score:52,st:"not_contacted",day:1 },
  { c:"InkPad",n:"Sarah Miles",e:"sarah@inkpad.co",s:"reddit",fit:"MEDIUM",score:70,st:"email_sent",day:2 },
  { c:"PulseHQ",n:"Chris Lee",e:"chris@pulsehq.io",s:"reddit",fit:"HIGH",score:89,st:"replied",day:2 },
  { c:"SendSpark",n:"Amara Osei",e:"amara@sendspark.io",s:"reddit",fit:"HIGH",score:83,st:"email_sent",day:2 },
  { c:"Outpulse",n:"Jake Morris",e:"jake@outpulse.io",s:"reddit",fit:"MEDIUM",score:67,st:"not_contacted",day:2 },
  { c:"MailBridge Clone",n:"Rachel Kim",e:"rachel@mbclone.co",s:"reddit",fit:"HIGH",score:94,st:"converted",day:2 },
  { c:"DripFlow",n:"Luca Rossi",e:"luca@dripflow.io",s:"reddit",fit:"HIGH",score:87,st:"replied",day:3 },
  { c:"BroadcastHQ",n:"Emma Taylor",e:"emma@broadcasthq.io",s:"reddit",fit:"MEDIUM",score:75,st:"email_sent",day:3 },
  { c:"MicroMail",n:"Aisha Diallo",e:"aisha@micromail.co",s:"reddit",fit:"LOW",score:48,st:"not_contacted",day:3 },
  { c:"CampaignCore",n:"Ben Wilson",e:"ben@campaigncore.io",s:"reddit",fit:"HIGH",score:90,st:"replied",day:3 },
  { c:"AutoReach",n:"Chloe Martin",e:"chloe@autoreach.io",s:"reddit",fit:"HIGH",score:84,st:"email_sent",day:3 },
  { c:"FormStack Alt",n:"Zach Brown",e:"zach@formstackalt.io",s:"reddit",fit:"MEDIUM",score:71,st:"email_sent",day:4 },
  { c:"Touchpoint",n:"Maya Garcia",e:"maya@touchpoint.io",s:"reddit",fit:"HIGH",score:88,st:"replied",day:4 },
  { c:"EngageKit",n:"Leo Zhang",e:"leo@engagekit.co",s:"reddit",fit:"MEDIUM",score:66,st:"email_sent",day:4 },
  { c:"SignalMail",n:"Anya Petrov",e:"anya@signalmail.io",s:"reddit",fit:"HIGH",score:93,st:"converted",day:4 },
  { c:"ConvertBase",n:"Ian McLeod",e:"ian@convertbase.io",s:"reddit",fit:"MEDIUM",score:73,st:"email_sent",day:4 },
  { c:"NudgeHQ",n:"Fatima Al-Amin",e:"fatima@nudgehq.io",s:"reddit",fit:"HIGH",score:82,st:"replied",day:5 },
  { c:"ClickFunnel Alt",n:"Tyler Davis",e:"tyler@clickfunnelalt.io",s:"reddit",fit:"LOW",score:55,st:"not_contacted",day:5 },
  { c:"SegmentPush",n:"Grace Liu",e:"grace@segmentpush.co",s:"reddit",fit:"MEDIUM",score:69,st:"email_sent",day:5 },
  { c:"LeadPilot",n:"Marcus Johnson",e:"marcus@leadpilot.io",s:"reddit",fit:"HIGH",score:91,st:"replied",day:5 },
  { c:"DropForge",n:"Isabelle Bernard",e:"isabelle@dropforge.io",s:"reddit",fit:"HIGH",score:86,st:"email_sent",day:5 },
  { c:"WarmUp Labs",n:"Kwame Asante",e:"kwame@warmuplabs.io",s:"reddit",fit:"MEDIUM",score:78,st:"email_sent",day:5 },
  { c:"AudienceKit",n:"Mia Thompson",e:"mia@audiencekit.io",s:"reddit",fit:"HIGH",score:89,st:"replied",day:6 },
  { c:"MailSweep",n:"Raj Mehta",e:"raj@mailsweep.io",s:"reddit",fit:"MEDIUM",score:64,st:"not_contacted",day:6 },
  { c:"BounceShield",n:"Sofia Reyes",e:"sofia@bounceshield.io",s:"reddit",fit:"HIGH",score:92,st:"email_sent",day:6 },
  { c:"ReachFlow",n:"Noah Anderson",e:"noah@reachflow.co",s:"reddit",fit:"LOW",score:50,st:"not_contacted",day:6 },
  { c:"ProspectMatic",n:"Lena Schneider",e:"lena@prospectmatic.io",s:"reddit",fit:"HIGH",score:85,st:"email_sent",day:6 },
  { c:"WaveOut",n:"Carlos Mendez",e:"carlos@waveout.io",s:"reddit",fit:"MEDIUM",score:72,st:"email_sent",day:6 },
  { c:"InboxCraft",n:"Yuki Tanaka",e:"yuki@inboxcraft.io",s:"reddit",fit:"HIGH",score:88,st:"replied",day:6 },
  { c:"QuickReach",n:"Zoe Williams",e:"zoe@quickreach.io",s:"reddit",fit:"MEDIUM",score:76,st:"email_sent",day:6 },
  { c:"MailVault",n:"Daniel Park",e:"daniel@mailvault.io",s:"reddit",fit:"HIGH",score:83,st:"replied",day:6 },
  { c:"SparkSend",n:"Elena Volkova",e:"elena@sparksend.io",s:"reddit",fit:"MEDIUM",score:70,st:"email_sent",day:6 },

  // g2 source (22)
  { c:"Meridian SaaS",n:"Sarah Chen",e:"sarah@meridian.io",s:"g2",fit:"HIGH",score:94,st:"converted",day:0 },
  { c:"CloudPulse",n:"James Kim",e:"james@cloudpulse.io",s:"g2",fit:"HIGH",score:89,st:"replied",day:0 },
  { c:"DataSync Pro",n:"Emily Ross",e:"emily@datasyncpro.com",s:"g2",fit:"MEDIUM",score:74,st:"email_sent",day:1 },
  { c:"AutoPitch",n:"Kevin O'Brien",e:"kevin@autopitch.io",s:"g2",fit:"HIGH",score:87,st:"email_sent",day:1 },
  { c:"OptiBase",n:"Nadia Fernandez",e:"nadia@optibase.co",s:"g2",fit:"MEDIUM",score:69,st:"email_sent",day:2 },
  { c:"GrowthEngine",n:"Arjun Nair",e:"arjun@growthengine.io",s:"g2",fit:"HIGH",score:91,st:"replied",day:2 },
  { c:"FrameForce",n:"Beatrice Müller",e:"beatrice@frameforce.io",s:"g2",fit:"MEDIUM",score:76,st:"email_sent",day:2 },
  { c:"VelocityOps",n:"Jerome Dupont",e:"jerome@velocityops.io",s:"g2",fit:"HIGH",score:88,st:"replied",day:3 },
  { c:"CoreStack",n:"Alicia Ruiz",e:"alicia@corestack.io",s:"g2",fit:"LOW",score:53,st:"not_contacted",day:3 },
  { c:"LaunchKit",n:"Patrick Nguyen",e:"patrick@launchkit.io",s:"g2",fit:"HIGH",score:90,st:"email_sent",day:3 },
  { c:"NexGen CRM",n:"Stella Obi",e:"stella@nexgencrm.com",s:"g2",fit:"MEDIUM",score:77,st:"email_sent",day:4 },
  { c:"PipelineOS",n:"Finn Larsen",e:"finn@pipelineos.io",s:"g2",fit:"HIGH",score:85,st:"replied",day:4 },
  { c:"ScopeBoard",n:"Hannah Clarke",e:"hannah@scopeboard.io",s:"g2",fit:"MEDIUM",score:71,st:"email_sent",day:4 },
  { c:"CatalystHQ",n:"Ali Hassan",e:"ali@catalysthq.io",s:"g2",fit:"HIGH",score:92,st:"converted",day:5 },
  { c:"GlassPanel",n:"Monica Svensson",e:"monica@glasspanel.io",s:"g2",fit:"MEDIUM",score:68,st:"email_sent",day:5 },
  { c:"ReachStack",n:"Samuel Yeboah",e:"samuel@reachstack.io",s:"g2",fit:"HIGH",score:87,st:"replied",day:5 },
  { c:"TractionHQ",n:"Charlotte Evans",e:"charlotte@tractionhq.io",s:"g2",fit:"MEDIUM",score:74,st:"email_sent",day:5 },
  { c:"DrivePeak",n:"Ivan Kozlov",e:"ivan@drivepeak.io",s:"g2",fit:"HIGH",score:86,st:"email_sent",day:6 },
  { c:"HubRocket",n:"Valentina Cruz",e:"valentina@hubrocket.co",s:"g2",fit:"MEDIUM",score:72,st:"email_sent",day:6 },
  { c:"NovaSaaS",n:"Otto Bergmann",e:"otto@novasaas.io",s:"g2",fit:"HIGH",score:89,st:"replied",day:6 },
  { c:"ApexFlow",n:"Layla Mohammed",e:"layla@apexflow.io",s:"g2",fit:"HIGH",score:93,st:"converted",day:6 },
  { c:"MomentumBase",n:"Ethan Walsh",e:"ethan@momentumbase.io",s:"g2",fit:"MEDIUM",score:75,st:"email_sent",day:6 },

  // producthunt source (20)
  { c:"Folio App",n:"Marcus Webb",e:"marcus@folioapp.io",s:"producthunt",fit:"HIGH",score:95,st:"converted",day:0 },
  { c:"LaunchBurst",n:"Tia Coleman",e:"tia@launchburst.io",s:"producthunt",fit:"HIGH",score:90,st:"replied",day:0 },
  { c:"Notewise",n:"Felix Braun",e:"felix@notewise.io",s:"producthunt",fit:"MEDIUM",score:73,st:"email_sent",day:1 },
  { c:"Buildbase",n:"Yara Hassan",e:"yara@buildbase.io",s:"producthunt",fit:"HIGH",score:88,st:"replied",day:1 },
  { c:"AppSignal Alt",n:"Connor Rice",e:"connor@appsignalalt.io",s:"producthunt",fit:"MEDIUM",score:67,st:"email_sent",day:2 },
  { c:"PageFlow",n:"Diana Torres",e:"diana@pageflow.io",s:"producthunt",fit:"HIGH",score:91,st:"replied",day:2 },
  { c:"ShipFast Clone",n:"Andrei Popescu",e:"andrei@shipfastclone.io",s:"producthunt",fit:"HIGH",score:86,st:"email_sent",day:2 },
  { c:"OakBlocks",n:"Amelia Grant",e:"amelia@oakblocks.io",s:"producthunt",fit:"MEDIUM",score:70,st:"email_sent",day:3 },
  { c:"DropHero",n:"Sven Lindqvist",e:"sven@drophero.io",s:"producthunt",fit:"HIGH",score:89,st:"replied",day:3 },
  { c:"SkyForms",n:"Nour Khalil",e:"nour@skyforms.io",s:"producthunt",fit:"MEDIUM",score:65,st:"not_contacted",day:3 },
  { c:"ArcDash",n:"Penelope Wright",e:"penelope@arcdash.io",s:"producthunt",fit:"HIGH",score:92,st:"converted",day:4 },
  { c:"VibeSend",n:"Joel Osei",e:"joel@vibesend.io",s:"producthunt",fit:"HIGH",score:84,st:"email_sent",day:4 },
  { c:"TabSpark",n:"Rosa Klein",e:"rosa@tabspark.io",s:"producthunt",fit:"MEDIUM",score:72,st:"email_sent",day:4 },
  { c:"FluxCMS",n:"Hassan Ibrahim",e:"hassan@fluxcms.io",s:"producthunt",fit:"HIGH",score:87,st:"replied",day:5 },
  { c:"BitPanel",n:"Clara Dupois",e:"clara@bitpanel.io",s:"producthunt",fit:"MEDIUM",score:68,st:"email_sent",day:5 },
  { c:"GridPush",n:"Rafael Morales",e:"rafael@gridpush.io",s:"producthunt",fit:"HIGH",score:90,st:"replied",day:5 },
  { c:"PostStack",n:"Akira Yamamoto",e:"akira@poststack.io",s:"producthunt",fit:"HIGH",score:85,st:"email_sent",day:6 },
  { c:"CardBase",n:"Ingrid Hansen",e:"ingrid@cardbase.io",s:"producthunt",fit:"MEDIUM",score:69,st:"not_contacted",day:6 },
  { c:"MassForm",n:"Diego Rios",e:"diego@massform.io",s:"producthunt",fit:"HIGH",score:88,st:"replied",day:6 },
  { c:"SeedCraft",n:"Vivienne Moreau",e:"vivienne@seedcraft.io",s:"producthunt",fit:"HIGH",score:91,st:"email_sent",day:6 },

  // linkedin source (12)
  { c:"PeakGrowth",n:"Jonathan Bailey",e:"jonathan@peakgrowth.io",s:"linkedin",fit:"HIGH",score:93,st:"converted",day:1 },
  { c:"MarketPulse",n:"Isabella Conti",e:"isabella@marketpulse.io",s:"linkedin",fit:"HIGH",score:88,st:"replied",day:1 },
  { c:"LeadDriven",n:"Sebastien Blanc",e:"sebastien@leaddriven.io",s:"linkedin",fit:"MEDIUM",score:74,st:"email_sent",day:2 },
  { c:"SignalOps",n:"Preethi Rajan",e:"preethi@signalops.io",s:"linkedin",fit:"HIGH",score:86,st:"email_sent",day:3 },
  { c:"SalesStack Pro",n:"Luke Harrison",e:"luke@salesstackpro.com",s:"linkedin",fit:"HIGH",score:91,st:"replied",day:3 },
  { c:"OutboundBase",n:"Camille Petit",e:"camille@outboundbase.io",s:"linkedin",fit:"MEDIUM",score:71,st:"email_sent",day:4 },
  { c:"DealPace",n:"Tobias Weber",e:"tobias@dealpace.io",s:"linkedin",fit:"HIGH",score:89,st:"replied",day:4 },
  { c:"FunnelBridge",n:"Chioma Eze",e:"chioma@funnelbridge.io",s:"linkedin",fit:"HIGH",score:87,st:"email_sent",day:5 },
  { c:"InsightClose",n:"Victor Larsson",e:"victor@insightclose.io",s:"linkedin",fit:"MEDIUM",score:76,st:"email_sent",day:5 },
  { c:"CloserKit",n:"Mei Zhang",e:"mei@closerkit.io",s:"linkedin",fit:"HIGH",score:92,st:"converted",day:6 },
  { c:"PitchMatic",n:"Aarav Sharma",e:"aarav@pitchmatic.io",s:"linkedin",fit:"MEDIUM",score:68,st:"not_contacted",day:6 },
  { c:"DealSync",n:"Brigitte Hoffman",e:"brigitte@dealsync.io",s:"linkedin",fit:"HIGH",score:84,st:"replied",day:6 },

  // directory source (6)
  { c:"SaaSHub Featured",n:"Patrick Walsh",e:"patrick@saashubfeatured.io",s:"directory",fit:"HIGH",score:90,st:"replied",day:2 },
  { c:"GetLatka Listed",n:"Annika Berg",e:"annika@getlatka.io",s:"directory",fit:"HIGH",score:86,st:"email_sent",day:3 },
  { c:"Capterra Listed",n:"Mahmoud El-Sayed",e:"mahmoud@capterra-co.io",s:"directory",fit:"MEDIUM",score:73,st:"email_sent",day:4 },
  { c:"AlternativeTo Top",n:"Sophie Martin",e:"sophie@alt-to.io",s:"directory",fit:"HIGH",score:88,st:"replied",day:5 },
  { c:"G2 Grid Leader",n:"Taichi Nakamura",e:"taichi@g2grid.io",s:"directory",fit:"HIGH",score:92,st:"converted",day:5 },
  { c:"SoftwareAdvice",n:"Bianca Romano",e:"bianca@swadvice.io",s:"directory",fit:"MEDIUM",score:70,st:"not_contacted",day:6 },
];

// ── Subjects for campaign drafts ──────────────────────────────────────────────
const SUBJECTS_Q2 = [
  "Quick question about your email stack",
  "saw your post on r/SaaS — had to reach out",
  "the real cost of bad email deliverability",
  "Your Mailchimp setup is costing you leads",
];

const SUBJECTS_CAP = [
  "Re: email automation for growing teams",
  "Had to reach out after your ProductHunt launch",
  "Fellow founder to founder",
  "Mailbridge → built for teams like yours",
];

const SUBJECTS_AI = [
  "saw you on r/SaaS — had to reach out",
  "AI + email = unfair outreach advantage",
  "Quick question about your email stack",
  "Your G2 reviews reveal something interesting",
];

// ── Reddit posts ──────────────────────────────────────────────────────────────
const REDDIT_POSTS = [
  { sub:"SaaS",title:"We're a 4-person team and drowning in manual email outreach — what's your workflow?",intent:"buying",score:94 },
  { sub:"startups",title:"Anyone replaced Mailchimp for their outbound? We send 800/mo and it's getting expensive",intent:"buying",score:91 },
  { sub:"Entrepreneur",title:"What cold email tools are founders actually using in 2025?",intent:"buying",score:88 },
  { sub:"SaaS",title:"Our reply rate is 4% and I want to cry — where are you at?",intent:"pain",score:86 },
  { sub:"marketing",title:"Mailchimp vs Klaviyo vs X — unpopular take incoming",intent:"discussion",score:75 },
  { sub:"startups",title:"Just got our first 5 customers from cold email — here's exactly what we did",intent:"discussion",score:82 },
  { sub:"SaaS",title:"We cut email vendor costs by 60% by switching — happy to share details",intent:"buying",score:79 },
  { sub:"Entrepreneur",title:"ActiveCampaign pricing just went up AGAIN — alternatives?",intent:"buying",score:93 },
  { sub:"smallbusiness",title:"How do you keep track of who you've emailed vs who's replied?",intent:"pain",score:71 },
  { sub:"SaaS",title:"Email deliverability deep dive — things I wish I knew earlier",intent:"discussion",score:68 },
  { sub:"marketing",title:"30% open rate, 2% reply — what am I doing wrong?",intent:"pain",score:84 },
  { sub:"startups",title:"Batch scheduling emails for timezone targeting — tools that actually work?",intent:"buying",score:77 },
  { sub:"SaaS",title:"We got a 22% reply rate last month using this exact template",intent:"discussion",score:89 },
  { sub:"Entrepreneur",title:"Honest review after 3 months of cold outreach as a solo founder",intent:"discussion",score:72 },
  { sub:"marketing",title:"AI-written emails are getting worse — fight me",intent:"discussion",score:65 },
  { sub:"SaaS",title:"When do you stop following up? I feel like I'm spamming people",intent:"pain",score:81 },
  { sub:"startups",title:"Small team (3 people) doing 500 outreach emails/week — AMA",intent:"discussion",score:76 },
  { sub:"Entrepreneur",title:"Tool recommendation for tracking opens/clicks without pixel blockers?",intent:"buying",score:87 },
  { sub:"smallbusiness",title:"My email list is 2,000 people and I need to move off Mailchimp ASAP",intent:"buying",score:90 },
  { sub:"SaaS",title:"Honest question: is cold email still worth it in 2025?",intent:"discussion",score:73 },
  { sub:"marketing",title:"GDPR-compliant cold outreach — here's how we handle it",intent:"discussion",score:64 },
  { sub:"startups",title:"We went from 0 to $15k MRR using only cold email — story inside",intent:"discussion",score:92 },
  { sub:"SaaS",title:"Best practices for warming up a new domain for cold outreach?",intent:"buying",score:85 },
  { sub:"Entrepreneur",title:"Looking for a Lemlist alternative — what are people using?",intent:"buying",score:96 },
  { sub:"marketing",title:"Personalization at scale — is it actually possible or just marketing speak?",intent:"discussion",score:78 },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Activate all campaigns
  await sql`
    UPDATE campaigns
    SET status = 'active', updated_at = ${new Date().toISOString()}
    WHERE organization_id = ${ORG}
  `;
  console.log("  ✓ Campaigns activated");

  // 2. Update ~60% of existing not_contacted leads to email_sent
  const existingLeads = await sql`
    SELECT id FROM leads WHERE organization_id = ${ORG} AND status = 'not_contacted' AND email_sent_at IS NULL
  `;
  const toEmail = existingLeads.filter(() => maybe(0.62));
  for (const lead of toEmail) {
    const sentAt = daysAgo(between(5, 28));
    const shouldReply = maybe(0.16);
    const shouldConvert = shouldReply && maybe(0.25);
    await sql`
      UPDATE leads SET
        status = ${shouldConvert ? 'converted' : shouldReply ? 'replied' : 'email_sent'},
        pipeline_stage = ${shouldConvert || shouldReply ? 'replied' : 'contacted'},
        email_sent_at = ${sentAt},
        replied_at = ${shouldReply ? daysAgo(between(1, 10)) : null},
        fit = CASE WHEN fit IS NULL THEN ${rand(['HIGH','HIGH','MEDIUM','MEDIUM','LOW'])} ELSE fit END,
        score = CASE WHEN score IS NULL THEN ${between(55, 95)} ELSE score END
      WHERE id = ${lead.id}
    `;
  }
  console.log(`  ✓ Updated ${toEmail.length} existing leads`);

  // 3. Insert new leads
  const newLeadIds = [];
  let inserted = 0;
  for (const co of COMPANIES) {
    const id = randomUUID();
    const now = new Date();
    const addedAt = daysAgo(co.day, 8); // spread within the day
    const sentAt = co.st !== 'not_contacted' ? daysAgo(co.day > 0 ? co.day - 0.5 : 0, 12) : null;
    const repliedAt = (co.st === 'replied' || co.st === 'converted') ? daysAgo(Math.max(0, co.day - 1), 6) : null;
    const pipelineStage = co.st === 'not_contacted' ? 'discovered'
      : co.st === 'email_sent' ? 'contacted' : 'replied';

    try {
      await sql`
        INSERT INTO leads (
          id, organization_id, company, website, what_they_do, ceo, email,
          source, fit, score, status, pipeline_stage,
          email_sent_at, replied_at, notes, discovered_at, added_at, updated_at,
          enrichment_attempts, is_valid, keyword_id
        ) VALUES (
          ${id}, ${ORG},
          ${co.c}, ${`https://${co.e.split('@')[1]}`},
          ${'B2B SaaS company scaling their email outreach and marketing automation.'},
          ${co.n}, ${co.e},
          ${co.s}, ${co.fit}, ${co.score}, ${co.st}, ${pipelineStage},
          ${sentAt}, ${repliedAt}, ${''}, ${addedAt}, ${addedAt}, ${now.toISOString()},
          ${co.st !== 'not_contacted' ? 1 : 0}, ${1}, ${KW1}
        )
      `;
      newLeadIds.push({ id, source: co.s, fit: co.fit, status: co.st, day: co.day });
      inserted++;
    } catch (err) {
      // Skip duplicates (email unique constraint)
      if (!err.message?.includes('unique') && !err.message?.includes('duplicate')) {
        console.warn(`  ⚠ Skipped ${co.c}: ${err.message}`);
      }
    }
  }
  console.log(`  ✓ Inserted ${inserted} new leads`);

  // 4. Assign new leads to campaigns + create drafts
  const campaignAssignments = [
    { campaignId: C_Q2,  subjects: SUBJECTS_Q2,  leads: newLeadIds.slice(0, 75),  stepRange:[1,3], sendDayRange:[25,1] },
    { campaignId: C_CAP, subjects: SUBJECTS_CAP, leads: newLeadIds.slice(10, 65), stepRange:[1,2], sendDayRange:[18,1] },
    { campaignId: C_AI,  subjects: SUBJECTS_AI,  leads: newLeadIds.slice(40, 85), stepRange:[1,2], sendDayRange:[12,1] },
  ];

  let totalDrafts = 0;

  for (const { campaignId, subjects, leads, stepRange, sendDayRange } of campaignAssignments) {
    for (const lead of leads) {
      const clId = randomUUID();
      // campaign_lead
      try {
        await sql`
          INSERT INTO campaign_leads (id, campaign_id, lead_id)
          VALUES (${clId}, ${campaignId}, ${lead.id})
          ON CONFLICT DO NOTHING
        `;
      } catch {}

      // campaign_draft — only for non not_contacted leads
      if (lead.status === 'not_contacted') continue;

      const draftId = randomUUID();
      const subject = rand(subjects);
      const stepNum = between(stepRange[0], stepRange[1]);
      const sentDaysAgo = between(sendDayRange[1], sendDayRange[0]);
      const sentAt = daysAgo(sentDaysAgo, 4);

      // Realistic tracking probabilities
      const wasOpened = maybe(0.44);
      const wasClicked = wasOpened && maybe(0.44);  // 44% of opens click
      const wasBounced = !wasOpened && maybe(0.025);
      const abVariant = maybe(0.5) ? 'a' : 'b';

      const openedAt = wasOpened ? new Date(new Date(sentAt).getTime() + between(1, 48) * 3600000).toISOString() : null;
      const clickedAt = wasClicked ? new Date(new Date(openedAt).getTime() + between(1, 24) * 3600000).toISOString() : null;
      const bouncedAt = wasBounced ? new Date(new Date(sentAt).getTime() + between(1, 6) * 3600000).toISOString() : null;

      try {
        await sql`
          INSERT INTO campaign_drafts (
            id, campaign_id, lead_id, channel, subject, body, status,
            sent_at, opened_at, clicked_at, bounced_at,
            ab_variant, step_number, created_at, updated_at
          ) VALUES (
            ${draftId}, ${campaignId}, ${lead.id}, 'email',
            ${subject},
            ${'Hi there,\n\nI came across your company and wanted to reach out about how Mailbridge helps fast-growing teams like yours...\n\nBest,\nThe nextreach team'},
            'sent', ${sentAt}, ${openedAt}, ${clickedAt}, ${bouncedAt},
            ${abVariant}, ${stepNum}, ${sentAt}, ${sentAt}
          )
          ON CONFLICT DO NOTHING
        `;
        totalDrafts++;
      } catch {}
    }
  }
  console.log(`  ✓ Created ${totalDrafts} campaign drafts`);

  // 5. Insert reddit posts for live activity feed
  let postCount = 0;
  for (let i = 0; i < REDDIT_POSTS.length; i++) {
    const post = REDDIT_POSTS[i];
    const postId = randomUUID();
    const fetchedAt = daysAgo(Math.floor(i / 4), 6);
    try {
      await sql`
        INSERT INTO reddit_posts (
          id, organization_id, reddit_id, subreddit, title, url, author,
          score, body, keyword_id, intent_type, intent_score,
          engagement_type, engagement_score, comment_count, has_replies, fetched_at
        ) VALUES (
          ${postId}, ${ORG}, ${`seed_${postId.slice(0,8)}`},
          ${post.sub}, ${post.title},
          ${`https://reddit.com/r/${post.sub}/comments/${postId.slice(0,6)}`},
          ${rand(['throwaway_founder','SaaS_builder','email_marketer','indie_hacker_2025','growth_guy'])},
          ${post.score},
          ${'This is something I\'ve been struggling with for months. Would love to hear from anyone who\'s solved this.'},
          ${KW1}, ${post.intent}, ${post.score},
          ${rand(['comment','post'])}, ${between(55, 95)},
          ${between(4, 47)}, ${maybe(0.7) ? 1 : 0}, ${fetchedAt}
        )
        ON CONFLICT DO NOTHING
      `;
      postCount++;
    } catch {}
  }
  console.log(`  ✓ Inserted ${postCount} reddit posts`);

  // 6. Summary
  const [leadCount] = await sql`SELECT COUNT(*) as n FROM leads WHERE organization_id = ${ORG}`;
  const [draftCount] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE cd.status = 'sent') as sent,
      COUNT(*) FILTER (WHERE cd.opened_at IS NOT NULL) as opened,
      COUNT(*) FILTER (WHERE cd.clicked_at IS NOT NULL) as clicked
    FROM campaign_drafts cd
    JOIN campaigns c ON c.id = cd.campaign_id
    WHERE c.organization_id = ${ORG}
  `;
  const [replyCount] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'replied') as replied,
      COUNT(*) FILTER (WHERE status = 'converted') as converted,
      COUNT(*) FILTER (WHERE email_sent_at IS NOT NULL) as contacted
    FROM leads WHERE organization_id = ${ORG}
  `;

  console.log("\n📊 Final state:");
  console.log(`   Total leads:    ${leadCount.n}`);
  console.log(`   Contacted:      ${replyCount.contacted}`);
  console.log(`   Replied:        ${replyCount.replied}`);
  console.log(`   Converted:      ${replyCount.converted}`);
  console.log(`   Emails sent:    ${draftCount.sent}`);
  console.log(`   Opens:         ${draftCount.opened} (${Math.round(draftCount.opened / draftCount.sent * 100)}%)`);
  console.log(`   Clicks:        ${draftCount.clicked} (${Math.round(draftCount.clicked / draftCount.sent * 100)}%)`);

  await sql.end();
  console.log("\n✅ Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
