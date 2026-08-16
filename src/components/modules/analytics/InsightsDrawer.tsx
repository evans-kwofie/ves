import * as React from "react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import {
  AiIdeaIcon,
  ChartIncreaseIcon,
  ChartDecreaseIcon,
  TestTube01Icon,
} from "hugeicons-react";
import type {
  WorkspaceStats,
  CampaignStat,
  StepDropoff,
  ABSummary,
} from "~/db/queries/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Insight {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}

// ─── Best-practice fallbacks ──────────────────────────────────────────────────

const BEST_PRACTICE_INSIGHTS: Insight[] = [
  {
    icon: <AiIdeaIcon size={16} />,
    title: "Send time drives open rates",
    body: "Emails sent Tuesday–Thursday between 8–10am local time see up to 30% higher open rates. Schedule campaigns within that window to maximise first impressions.",
  },
  {
    icon: <AiIdeaIcon size={16} />,
    title: "Ask, don't tell — in your subject line",
    body: 'Subject lines phrased as questions consistently outperform statements. Instead of "Intro to [Product]", try "Quick question about [Company]" for a 2x lift in opens.',
  },
  {
    icon: <AiIdeaIcon size={16} />,
    title: "Follow-ups close deals, not first touches",
    body: "80% of positive replies come on the 2nd or 3rd message. If your campaigns only have one step, add a follow-up sequence — brevity is key on step 2.",
  },
  {
    icon: <AiIdeaIcon size={16} />,
    title: "Personalise beyond the first name",
    body: "Mentioning exactly what a lead's company does — pulled from enrichment data — in your opening line lifts reply rates 2–3x over generic templates. Use {{whatTheyDo}} in your template body.",
  },
];

// ─── Insight generation ───────────────────────────────────────────────────────

function generateInsights(
  stats: WorkspaceStats,
  campaigns: CampaignStat[],
  stepDropoff: StepDropoff[],
  abSummary: ABSummary,
): Insight[] {
  const insights: Insight[] = [];

  if (stats.emailSent > 0) {
    if (stats.openRate < 20 && stats.emailSent >= 5) {
      insights.push({
        icon: <ChartDecreaseIcon size={16} />,
        title: "Open rate needs attention",
        body: `Your open rate is ${stats.openRate}% — industry average is 20–30%. A/B test shorter subject lines or add the recipient's first name. Personalised subjects consistently outperform generic ones.`,
      });
    } else if (stats.openRate >= 30) {
      insights.push({
        icon: <ChartIncreaseIcon size={16} />,
        title: "Strong open rate",
        body: `${stats.openRate}% open rate puts you well above average. Whatever you're doing in subject lines is working — keep it consistent across new campaigns.`,
        accent: true,
      });
    }

    if (stats.replyRate === 0 && stats.totalContacted >= 5) {
      insights.push({
        icon: <AiIdeaIcon size={16} />,
        title: "No replies yet — check deliverability",
        body: "You've sent emails but no one has replied. Verify your domain SPF/DKIM is set up, shorten your opening message, and end with a single direct question rather than a pitch.",
      });
    } else if (stats.replyRate >= 10) {
      insights.push({
        icon: <ChartIncreaseIcon size={16} />,
        title: "Exceptional reply rate",
        body: `${stats.replyRate}% reply rate is exceptional — most cold outreach averages 1–5%. Your personalisation is clearly landing. Consider increasing lead volume to scale this.`,
        accent: true,
      });
    } else if (stats.replyRate > 0 && stats.replyRate < 3) {
      insights.push({
        icon: <AiIdeaIcon size={16} />,
        title: "Boost replies with follow-up steps",
        body: `Only ${stats.replyRate}% of contacted leads replied. Most conversions happen on the 2nd or 3rd touchpoint — add follow-up steps to your active campaigns and keep them under 5 sentences.`,
      });
    }

    if (stats.bounceRate > 5) {
      insights.push({
        icon: <ChartDecreaseIcon size={16} />,
        title: "High bounce rate hurts your sender score",
        body: `${stats.bounceRate}% of emails are bouncing. Run your lead list through an email verifier before sending, and avoid role-based addresses (info@, support@, contact@).`,
      });
    }

    if (stats.clickRate > 0 && stats.replyRate === 0) {
      insights.push({
        icon: <AiIdeaIcon size={16} />,
        title: "Clicks but no replies",
        body: "Leads are clicking links but not replying. The linked page may not be converting. Try removing links entirely and replacing them with a direct question — lower friction means more replies.",
      });
    }

    const bestCampaign = [...campaigns]
      .filter((c) => c.sentCount > 0)
      .sort((a, b) => b.replyRate - a.replyRate)[0];
    if (bestCampaign && bestCampaign.replyRate > 0 && campaigns.length > 1) {
      insights.push({
        icon: <ChartIncreaseIcon size={16} />,
        title: `Top campaign: ${bestCampaign.name}`,
        body: `This campaign has a ${bestCampaign.replyRate}% reply rate — your highest. Study its template and targeting, and replicate the approach in new campaigns.`,
        accent: true,
      });
    }

    const bycamp = new Map<string, StepDropoff[]>();
    for (const s of stepDropoff) {
      if (!bycamp.has(s.campaignId)) bycamp.set(s.campaignId, []);
      bycamp.get(s.campaignId)!.push(s);
    }
    for (const [, steps] of bycamp) {
      if (steps.length < 2) continue;
      const step1 = steps.find((s) => s.stepNumber === 1);
      const step2 = steps.find((s) => s.stepNumber === 2);
      if (
        step1 &&
        step2 &&
        step1.sent > 0 &&
        step2.sent > 0 &&
        step2.replyRate > step1.replyRate
      ) {
        insights.push({
          icon: <AiIdeaIcon size={16} />,
          title: "Your follow-ups outperform first touches",
          body: `In "${step1.campaignName}", step 2 has a ${step2.replyRate}% reply rate vs step 1's ${step1.replyRate}%. Rewrite step 1 to be shorter and mirror the approach that's working in step 2.`,
        });
        break;
      }
    }

    if (abSummary.campaignsWithAB > 0) {
      const winner =
        abSummary.aWins > abSummary.bWins
          ? "Variant A"
          : abSummary.bWins > abSummary.aWins
            ? "Variant B"
            : null;
      if (winner) {
        insights.push({
          icon: <TestTube01Icon size={16} />,
          title: `${winner} is winning your A/B tests`,
          body: `Across ${abSummary.campaignsWithAB} campaign${abSummary.campaignsWithAB > 1 ? "s" : ""} with A/B testing, ${winner} leads in ${Math.max(abSummary.aWins, abSummary.bWins)} of them. Make that variant the default and iterate on the losing one.`,
          accent: true,
        });
      }
    }
  }

  let i = 0;
  while (insights.length < 4 && i < BEST_PRACTICE_INSIGHTS.length) {
    insights.push(BEST_PRACTICE_INSIGHTS[i++]);
  }

  return insights.slice(0, 4);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InsightsDrawerProps {
  stats: WorkspaceStats;
  campaigns: CampaignStat[];
  stepDropoff: StepDropoff[];
  abSummary: ABSummary;
}

export function InsightsDrawer({
  stats,
  campaigns,
  stepDropoff,
  abSummary,
}: InsightsDrawerProps) {
  const insights = generateInsights(stats, campaigns, stepDropoff, abSummary);
  const accentCount = insights.filter((i) => i.accent).length;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 text-[12px]">
            <AiIdeaIcon size={13} />
            View Insights
            {accentCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold">
                {accentCount}
              </span>
            )}
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-md w-full">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <AiIdeaIcon size={15} className="text-accent" />
            <SheetTitle>AI Insights</SheetTitle>
          </div>
          <SheetDescription>
            Recommendations based on your outreach performance
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border flex gap-3 ${
                insight.accent
                  ? "border-accent/30 bg-accent/5"
                  : "border-card-border bg-card"
              }`}
            >
              <div
                className={`mt-0.5 shrink-0 ${insight.accent ? "text-accent" : "text-muted-foreground"}`}
              >
                {insight.icon}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[12px] font-semibold mb-1.5 ${insight.accent ? "text-accent" : "text-foreground"}`}
                >
                  {insight.title}
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {insight.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
