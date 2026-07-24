import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  getWorkspaceStats,
  getCampaignStats,
  getSendVolume,
  getStepDropoff,
  getABSummary,
  getTopSubjects,
  getSourcePerformance,
  type DailyVolume,
  type StepDropoff,
} from "~/db/queries/analytics";
import { getSessionFn } from "~/lib/session";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  BarChartIcon,
  Mail01Icon,
  Linkedin01Icon,
  InstagramIcon,
  TestTube01Icon,
  Target01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
} from "hugeicons-react";
import { InsightsDrawer } from "~/components/modules/analytics/InsightsDrawer";
import { EmptyState } from "~/components/ui/empty-state";

// ─── Server fn ────────────────────────────────────────────────────────────────

const getAnalytics = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: workspaceId }) => {
    const session = await getSessionFn();
    if (!session) return null;
    const headers = getRequestHeaders();
    const orgs = await auth.api.listOrganizations({ headers });
    const org = orgs?.find((o) => o.slug === workspaceId || o.id === workspaceId) ?? null;
    if (!org) return null;

    const [stats, campaigns, volume, stepDropoff, abSummary, topSubjects, sourcePerformance] = await Promise.all([
      getWorkspaceStats(org.id),
      getCampaignStats(org.id),
      getSendVolume(org.id, 30),
      getStepDropoff(org.id),
      getABSummary(org.id),
      getTopSubjects(org.id),
      getSourcePerformance(org.id),
    ]);

    return { stats, campaigns, volume, stepDropoff, abSummary, topSubjects, sourcePerformance };
  });

export const Route = createFileRoute("/$workspaceId/analytics")({
  loader: ({ params }) => getAnalytics({ data: params.workspaceId }),
  component: AnalyticsPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctStr(n: number) {
  return `${n}%`;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function rateColor(rate: number, good: "high" | "low" = "high") {
  if (good === "low") {
    if (rate === 0) return "text-muted-foreground";
    if (rate < 3) return "text-accent";
    if (rate < 8) return "text-amber-500";
    return "text-destructive";
  }
  if (rate === 0) return "text-muted-foreground";
  if (rate >= 20) return "text-accent";
  if (rate >= 10) return "text-amber-500";
  return "text-muted-foreground";
}


// ─── Charts ───────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: DailyVolume[] }) {
  const counts = data.map((d) => d.sent);
  const max = Math.max(...counts, 1);
  const W = 520;
  const H = 120;
  const PAD = { top: 8, right: 4, bottom: 28, left: 28 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const barW = Math.max(1, (iW / counts.length) - 2);

  const yTicks = [0, Math.round(max / 2), max];

  // Show label every 5 days
  const labelIdxs = new Set<number>();
  [0, 6, 13, 20, 27, counts.length - 1].forEach((i) => {
    if (i >= 0 && i < counts.length) labelIdxs.add(i);
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {yTicks.map((t) => {
        const y = PAD.top + iH - (t / max) * iH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + iW} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">{t}</text>
          </g>
        );
      })}
      {counts.map((v, i) => {
        const x = PAD.left + (i / counts.length) * iW + 1;
        const barH = (v / max) * iH;
        const y = PAD.top + iH - barH;
        const label = new Date(data[i].date).toLocaleDateString("en", { month: "short", day: "numeric" });
        return (
          <g key={i}>
            <rect
              x={x}
              y={v === 0 ? PAD.top + iH - 1 : y}
              width={barW}
              height={v === 0 ? 1 : barH}
              rx="2"
              fill={v === 0 ? "var(--border)" : "var(--accent)"}
              opacity={v === 0 ? 0.4 : 0.85}
            />
            {labelIdxs.has(i) && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FunnelBar({ label, value, total, color = "var(--accent)" }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color }}>{fmt(value)}</span>
          {total > 0 && value !== total && (
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          )}
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full funnel-fill"
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const data = Route.useLoaderData();
  const { workspaceId } = Route.useParams();

  if (!data) {
    return (
      <div className="page-content">
        <EmptyState title="Failed to load analytics data" />
      </div>
    );
  }

  const { stats, campaigns, volume, stepDropoff, abSummary, topSubjects, sourcePerformance } = data;

  const totalSent = stats.emailSent + stats.linkedinSent + stats.instagramSent;
  const hasAnyData = totalSent > 0 || stats.totalLeads > 0;

  // Group step dropoff by campaign
  const dropoffByCampaign = new Map<string, StepDropoff[]>();
  for (const s of stepDropoff) {
    if (!dropoffByCampaign.has(s.campaignId)) dropoffByCampaign.set(s.campaignId, []);
    dropoffByCampaign.get(s.campaignId)!.push(s);
  }
  const multiStepCampaigns = [...dropoffByCampaign.entries()].filter(([, steps]) => steps.length > 1);

  return (
    <div className="page-content flex flex-col gap-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Analytics</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Workspace-level outreach performance · last updated now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InsightsDrawer
            stats={stats}
            campaigns={campaigns}
            stepDropoff={stepDropoff}
            abSummary={abSummary}
          />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            <BarChartIcon size={12} />
            All time
          </div>
        </div>
      </div>

      {/* ── Hero metric strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          index={0}
          label="Emails Sent"
          value={fmt(stats.emailSent)}
          sub={totalSent > stats.emailSent ? `+${fmt(stats.linkedinSent + stats.instagramSent)} social` : "across all campaigns"}
          icon={<Mail01Icon size={13} className="text-accent" />}
        />
        <MetricCard
          index={1}
          label="Delivery Rate"
          value={stats.emailSent > 0 ? pctStr(stats.deliveryRate) : "—"}
          sub={stats.emailSent > 0 ? `${fmt(stats.emailDelivered)} delivered` : "no emails sent yet"}
          valueClass={stats.emailSent > 0 ? rateColor(stats.deliveryRate) : "text-muted-foreground"}
          benchmark="98%+ target"
        />
        <MetricCard
          index={2}
          label="Open Rate"
          value={pctStr(stats.openRate)}
          sub={stats.emailOpened > 0 ? `${fmt(stats.emailOpened)} emails opened` : "no data yet"}
          valueClass={rateColor(stats.openRate)}
          benchmark="20% avg"
        />
        <MetricCard
          index={3}
          label="Click Rate"
          value={pctStr(stats.clickRate)}
          sub={stats.emailClicked > 0 ? `${fmt(stats.emailClicked)} clicks` : "no data yet"}
          valueClass={rateColor(stats.clickRate)}
          benchmark="3% avg"
        />
        <MetricCard
          index={4}
          label="Reply Rate"
          value={pctStr(stats.replyRate)}
          sub={`${fmt(stats.totalReplied)} of ${fmt(stats.totalContacted)} replied`}
          valueClass={rateColor(stats.replyRate)}
          benchmark="2% avg"
        />
        <MetricCard
          index={5}
          label="Conversion %"
          value={stats.totalContacted > 0 ? pctStr(stats.conversionRate) : "—"}
          sub={`${fmt(stats.convertedLeads)} leads converted`}
          valueClass={stats.convertedLeads > 0 ? rateColor(stats.conversionRate) : "text-muted-foreground"}
          icon={<Target01Icon size={13} className="text-accent" />}
        />
        <MetricCard
          index={6}
          label="Bounce Rate"
          value={stats.emailBounced > 0 ? pctStr(stats.bounceRate) : "—"}
          sub={stats.emailBounced > 0 ? `${fmt(stats.emailBounced)} bounced` : "tracking via webhook"}
          valueClass={rateColor(stats.bounceRate, "low")}
          benchmark="< 2% target"
        />
        <MetricCard
          index={7}
          label="LinkedIn Sent"
          value={fmt(stats.linkedinSent)}
          sub={stats.instagramSent > 0 ? `+${fmt(stats.instagramSent)} Instagram` : "manual queue"}
          icon={<Linkedin01Icon size={13} className="text-[#0A66C2]" />}
        />
      </div>

      {/* ── Send volume + Channel breakdown ───────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 260px" }}>
        <div className="card p-5">
          <p className="text-[13px] font-semibold">Send Volume</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Emails sent per day — last 30 days</p>
          {volume.every((v) => v.sent === 0) ? (
            <div className="h-28 flex items-center justify-center text-[12px] text-muted-foreground">
              No emails sent in the last 30 days
            </div>
          ) : (
            <BarChart data={volume} />
          )}
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <p className="text-[13px] font-semibold">Channels</p>
          <ChannelRow
            icon={<Mail01Icon size={13} />}
            label="Email"
            sent={stats.emailSent}
            replyRate={stats.replyRate}
            color="var(--accent)"
          />
          <ChannelRow
            icon={<Linkedin01Icon size={13} />}
            label="LinkedIn"
            sent={stats.linkedinSent}
            replyRate={0}
            color="#0A66C2"
            note="manual"
          />
          <ChannelRow
            icon={<InstagramIcon size={13} />}
            label="Instagram"
            sent={stats.instagramSent}
            replyRate={0}
            color="#E1306C"
            note="manual"
          />
        </div>
      </div>

      {/* ── Conversion Funnel ─────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold">Conversion Funnel</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Where leads drop off in your outreach pipeline</p>
          </div>
          {!hasAnyData && (
            <span className="text-[11px] text-muted-foreground">Add leads to see your funnel</span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <FunnelBar label="Total leads in pipeline" value={stats.totalLeads} total={stats.totalLeads} color="var(--muted-foreground)" />
          <DropArrow pct={stats.totalLeads > 0 ? Math.round((stats.totalContacted / stats.totalLeads) * 100) : 0} label="contacted" />
          <FunnelBar label="Contacted (email or LinkedIn)" value={stats.totalContacted} total={stats.totalLeads} color="var(--accent)" />
          <DropArrow pct={stats.emailSent > 0 ? stats.openRate : 0} label="opened" />
          <FunnelBar label="Opened email" value={stats.emailOpened} total={stats.totalContacted} color="var(--accent)" />
          <DropArrow pct={stats.emailOpened > 0 ? Math.round((stats.emailClicked / stats.emailOpened) * 100) : 0} label="clicked" />
          <FunnelBar label="Clicked link" value={stats.emailClicked} total={stats.emailOpened} color="var(--accent)" />
          <DropArrow pct={stats.totalContacted > 0 ? stats.replyRate : 0} label="replied" />
          <FunnelBar label="Replied" value={stats.totalReplied} total={stats.totalContacted} color="var(--accent)" />
        </div>
      </div>

      {/* ── Campaign table ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold">Campaign Performance</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total</p>
          </div>
          <Link
            to="/$workspaceId/campaigns"
            params={{ workspaceId }}
            className="text-[11px] font-semibold text-accent no-underline flex items-center gap-1"
          >
            View all <ArrowUpRight01Icon size={11} />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" size="sm" />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Campaign", "Leads", "Sent", "Open Rate", "Click Rate", "Reply Rate", "Bounce", "Status"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-2.5 border-b border-border pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={i !== campaigns.length - 1 ? "border-b border-border" : ""}>
                  <td className="py-3 pr-4">
                    <Link
                      to="/$workspaceId/campaigns/$id"
                      params={{ workspaceId, id: c.id }}
                      className="text-[12px] font-semibold no-underline hover:text-accent transition-colors flex items-center gap-1.5"
                    >
                      {c.name}
                      {c.hasAB && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded px-1 py-0.5">
                          <TestTube01Icon size={8} />A/B
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-[12px] text-muted-foreground">{fmt(c.leadCount)}</td>
                  <td className="py-3 pr-4 text-[12px]">{fmt(c.sentCount)}</td>
                  <td className="py-3 pr-4">
                    <RateCell value={c.openRate} direction="high" />
                  </td>
                  <td className="py-3 pr-4">
                    <RateCell value={c.clickRate} direction="high" />
                  </td>
                  <td className="py-3 pr-4">
                    <RateCell value={c.replyRate} direction="high" />
                  </td>
                  <td className="py-3 pr-4">
                    <RateCell value={c.bounceRate} direction="low" />
                  </td>
                  <td className="py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Step Drop-off + A/B side by side ─────────────────────────── */}
      {(multiStepCampaigns.length > 0 || abSummary.campaignsWithAB > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {/* Step Drop-off */}
          {multiStepCampaigns.length > 0 && (
            <div className="card p-5">
              <p className="text-[13px] font-semibold mb-1">Step-by-step Drop-off</p>
              <p className="text-[11px] text-muted-foreground mb-4">Which sequence steps convert leads to replies</p>
              <div className="flex flex-col gap-4">
                {multiStepCampaigns.slice(0, 3).map(([campaignId, steps]) => (
                  <div key={campaignId}>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-2 truncate">{steps[0].campaignName}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {steps.map((step, i) => (
                        <React.Fragment key={step.stepNumber}>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${step.replied > 0 ? "bg-accent text-white" : "bg-muted text-muted-foreground"}`}>
                              {step.stepNumber}
                            </div>
                            <span className="text-[9px] text-muted-foreground">{step.replyRate}%</span>
                            <span className="text-[8px] text-muted-foreground">{fmt(step.sent)} sent</span>
                          </div>
                          {i < steps.length - 1 && (
                            <ArrowRight01Icon size={12} className="text-muted-foreground mb-4" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A/B Summary */}
          {abSummary.campaignsWithAB > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <TestTube01Icon size={13} className="text-accent" />
                <p className="text-[13px] font-semibold">A/B Test Summary</p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">
                {abSummary.campaignsWithAB} campaign{abSummary.campaignsWithAB > 1 ? "s" : ""} running A/B tests
              </p>
              <div className="grid grid-cols-3 gap-3">
                <ABCard label="Variant A" wins={abSummary.aWins} total={abSummary.campaignsWithAB} color="blue" />
                <ABCard label="Variant B" wins={abSummary.bWins} total={abSummary.campaignsWithAB} color="purple" />
                <ABCard label="Tied" wins={abSummary.tied} total={abSummary.campaignsWithAB} color="gray" />
              </div>
              {abSummary.aWins === 0 && abSummary.bWins === 0 && (
                <p className="text-[11px] text-muted-foreground mt-3">No replies yet to determine a winner.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Top Subject Lines + Lead Source Performance ───────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Subject Lines */}
        <div className="card p-5">
          <p className="text-[13px] font-semibold mb-0.5">Top Subject Lines</p>
          <p className="text-[11px] text-muted-foreground mb-4">Ranked by open rate — email campaigns only</p>
          {topSubjects.length === 0 ? (
            <EmptyState title="No email subject data yet" size="sm" />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {topSubjects.map((s, i) => (
                <div key={i} className="py-2.5 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium leading-snug flex-1 min-w-0 truncate" title={s.subject}>
                      {s.subject}
                    </p>
                    <span className={`text-[12px] font-bold shrink-0 ${rateColor(s.openRate)}`}>{s.openRate}%</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{fmt(s.sent)} sent</span>
                    {s.opened > 0 && <span>{fmt(s.opened)} opened</span>}
                    {s.clicked > 0 && <span>{s.clickRate}% CTR</span>}
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full funnel-fill"
                      style={{ width: `${Math.max(s.openRate, s.openRate > 0 ? 2 : 0)}%`, background: "var(--accent)", opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Source Performance */}
        <div className="card p-5">
          <p className="text-[13px] font-semibold mb-0.5">Lead Source Performance</p>
          <p className="text-[11px] text-muted-foreground mb-4">Reply rate by where leads came from</p>
          {sourcePerformance.length === 0 ? (
            <EmptyState title="No lead source data yet" size="sm" />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {sourcePerformance.map((s, i) => (
                <div key={i} className="py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium capitalize">{s.source}</p>
                    <span className={`text-[12px] font-bold ${rateColor(s.replyRate)}`}>
                      {s.contacted > 0 ? `${s.replyRate}% reply` : "not contacted"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{fmt(s.total)} leads</span>
                    <span>{fmt(s.contacted)} contacted</span>
                    {s.replied > 0 && <span>{fmt(s.replied)} replied</span>}
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full funnel-fill"
                      style={{ width: `${Math.max(s.replyRate, s.replyRate > 0 ? 2 : 0)}%`, background: "var(--accent)", opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon, valueClass, benchmark, index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueClass?: string;
  benchmark?: string;
  index?: number;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2 card-enter" style={{ "--card-i": index } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`text-[26px] font-extrabold tracking-tight leading-none ${valueClass ?? "text-foreground"}`}>
        {value}
      </p>
      {benchmark && (
        <p className="text-[10px] text-muted-foreground font-medium">{benchmark}</p>
      )}
      {sub && (
        <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p>
      )}
    </div>
  );
}

function ChannelRow({
  icon, label, sent, replyRate, color, note,
}: {
  icon: React.ReactNode;
  label: string;
  sent: number;
  replyRate: number;
  color: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium">{label}</span>
          <span className="text-[11px] font-semibold" style={{ color: sent > 0 ? color : undefined }}>
            {sent > 0 ? fmt(sent) : "—"}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: sent > 0 ? "100%" : "0%", background: color, opacity: 0.7 }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {sent > 0
            ? (note ? `${note} — ${replyRate}% reply rate` : `${replyRate}% reply rate`)
            : "no messages sent"}
        </p>
      </div>
    </div>
  );
}

function DropArrow({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center gap-2 ml-2">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-0.5 h-3 bg-border" />
        <ArrowRight01Icon size={10} className="text-muted-foreground rotate-90" />
      </div>
      <span className="text-[10px] text-muted-foreground">
        {pct > 0 ? `${pct}% ${label}` : `0 ${label}`}
      </span>
    </div>
  );
}

function RateCell({ value, direction }: { value: number; direction: "high" | "low" }) {
  if (value === 0) return <span className="text-[12px] text-muted-foreground">—</span>;
  const isGood = direction === "high" ? value >= 10 : value < 3;
  const isMid = direction === "high" ? value >= 3 : value < 8;
  const colorClass = isGood ? "text-accent" : isMid ? "text-amber-500" : "text-destructive";
  return <span className={`text-[12px] font-semibold ${colorClass}`}>{value}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "badge badge-green",
    draft: "badge badge-gray",
    paused: "bg-amber-500/10 text-amber-600 text-[10px] font-semibold px-2 py-0.5 rounded",
    completed: "badge badge-blue",
  };
  return (
    <span className={map[status] ?? "badge badge-gray"}>
      {status}
    </span>
  );
}

function ABCard({ label, wins, total, color }: { label: string; wins: number; total: number; color: "blue" | "purple" | "gray" }) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    gray: "bg-muted text-muted-foreground border-border",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color]}`}>
      <p className="text-[20px] font-extrabold leading-none">{wins}</p>
      <p className="text-[10px] font-semibold mt-1">{label}</p>
      <p className="text-[10px] opacity-60 mt-0.5">of {total}</p>
    </div>
  );
}
