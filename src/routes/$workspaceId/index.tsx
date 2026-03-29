import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getDashboardStats, getRecentLeads, getLeadGrowth } from "~/db/queries/leads";
import { getRedditPostCount, getRecentRedditActivity } from "~/db/queries/reddit";
import { listKeywords } from "~/db/queries/keywords";
import { getSessionFn } from "~/lib/session";
import { ArrowUpRight01Icon, MinusSignIcon } from "hugeicons-react";
import type { Lead } from "~/types/lead";

const getDashboard = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => {
    const [session, leadStats, redditCount, keywords, recentLeads, leadGrowth, recentActivity] =
      await Promise.all([
        getSessionFn(),
        getDashboardStats(orgId),
        getRedditPostCount(orgId),
        listKeywords(orgId),
        getRecentLeads(orgId, 5),
        getLeadGrowth(orgId),
        getRecentRedditActivity(orgId, 4),
      ]);
    return {
      userName: session?.user.name ?? "",
      ...leadStats,
      redditPosts: redditCount,
      activeKeywords: keywords.filter((k) => k.isActive).length,
      recentLeads,
      leadGrowth,
      recentActivity,
    };
  });

export const Route = createFileRoute("/$workspaceId/")({
  loader: ({ params }) => getDashboard({ data: params.workspaceId }),
  component: DashboardPage,
});

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 64;
  const h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace(/[^a-z]/gi, "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Lead growth chart ────────────────────────────────────────────────────────

function LeadGrowthChart({ data }: { data: { date: string; count: number }[] }) {
  const counts = data.map((d) => d.count);
  const max = Math.max(...counts, 1);
  const W = 480;
  const H = 120;
  const PAD = { top: 10, right: 8, bottom: 28, left: 28 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const pts = counts.map((v, i) => ({
    x: PAD.left + (i / (counts.length - 1)) * iW,
    y: PAD.top + iH - (v / max) * iH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${PAD.top + iH} L${pts[0].x},${PAD.top + iH} Z`;
  const labels = data.map((d) => new Date(d.date).toLocaleDateString("en", { weekday: "short" }));
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t) => {
        const y = PAD.top + iH - (t / max) * iH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + iW} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">{t}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#cg)" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="var(--card)" strokeWidth="1.5" />
      ))}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">{labels[i]}</text>
      ))}
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name.split(" ")[0]}.` : `${time}.`;
}

const INTENT_DOT: Record<string, string> = {
  buying: "bg-[var(--accent)]",
  pain: "bg-amber-400",
  discussion: "bg-[var(--muted-foreground)]",
  noise: "bg-[var(--muted-foreground)]",
};

const FIT_COLOR: Record<string, string> = {
  HIGH: "text-[var(--accent)]",
  MEDIUM: "text-amber-400",
  LOW: "text-[var(--muted-foreground)]",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const data = Route.useLoaderData();
  const { workspaceId } = Route.useParams();

  const convRate = data.totalLeads > 0
    ? ((data.converted / data.totalLeads) * 100).toFixed(1)
    : "0.0";
  const growthCounts = data.leadGrowth.map((d) => d.count);
  const totalThisWeek = growthCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="page-content flex flex-col gap-6">

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">
            {greeting(data.userName)}
          </h1>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            Here's what's happening across your pipeline today.
          </p>
        </div>
        <Link
          to="/$workspaceId/campaigns/new"
          params={{ workspaceId }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius)] bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-semibold no-underline hover:opacity-90 transition-opacity"
        >
          + New Campaign
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={fmt(data.totalLeads)}
          sub={`+${totalThisWeek} this week`}
          trend={totalThisWeek > 0 ? "up" : "flat"}
          sparkline={growthCounts}
        />
        <StatCard
          label="Active Keywords"
          value={fmt(data.activeKeywords)}
          sub="Monitoring Reddit"
          sparkline={[data.activeKeywords, data.activeKeywords]}
          sparkColor="var(--muted-foreground)"
        />
        <StatCard
          label="Reddit Signals"
          value={fmt(data.redditPosts)}
          sub="Posts classified"
          sparkline={growthCounts.map((v) => Math.round(v * 2.3))}
          sparkColor="#f59e0b"
        />
        <StatCard
          label="Conv. Rate"
          value={`${convRate}%`}
          sub={`${data.converted} converted`}
          trend={data.converted > 0 ? "up" : "flat"}
          progress={parseFloat(convRate)}
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 280px" }}>
        <div className="card p-5">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Lead Growth</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 mb-4">New leads per day — last 7 days</p>
          <LeadGrowthChart data={data.leadGrowth} />
        </div>

        <div className="card p-5 flex flex-col gap-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Live Activity</p>
            <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full">LIVE</span>
          </div>

          {data.recentActivity.length === 0 ? (
            <p className="text-[12px] text-[var(--muted-foreground)]">No signals yet. Fetch some Reddit posts.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.recentActivity.map((item) => (
                <div key={item.id} className="flex gap-2.5 items-start">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${INTENT_DOT[item.intentType ?? ""] ?? "bg-[var(--muted-foreground)]"}`} />
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--foreground)] leading-snug truncate">{item.title}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">r/{item.subreddit} · {timeAgo(item.fetchedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/$workspaceId/reddit"
            params={{ workspaceId }}
            className="text-[11px] font-semibold text-[var(--accent)] no-underline mt-auto pt-4 tracking-wide"
          >
            VIEW ALL SIGNALS →
          </Link>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Recent Leads</p>
          <Link to="/$workspaceId/pipeline" params={{ workspaceId }} className="text-[11px] font-semibold text-[var(--accent)] no-underline">
            View all →
          </Link>
        </div>

        {data.recentLeads.length === 0 ? (
          <p className="text-[12px] text-[var(--muted-foreground)]">No leads yet. Run the Reddit agent to auto-discover leads.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Company", "Contact", "Fit", "Status", "Added"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] pb-2.5 border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentLeads.map((lead: Lead) => (
                <tr key={lead.id} className="border-b border-[var(--border)]">
                  <td className="py-2.5 text-[12px] font-semibold text-[var(--foreground)]">{lead.company}</td>
                  <td className="py-2.5 text-[12px] text-[var(--muted-foreground)]">{lead.ceo}</td>
                  <td className="py-2.5">
                    {lead.fit
                      ? <span className={`text-[10px] font-bold uppercase tracking-wide ${FIT_COLOR[lead.fit] ?? "text-[var(--muted-foreground)]"}`}>{lead.fit}</span>
                      : <span className="text-[11px] text-[var(--muted-foreground)]">—</span>
                    }
                  </td>
                  <td className="py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] capitalize">
                      {lead.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2.5 text-[11px] text-[var(--muted-foreground)]">{timeAgo(lead.addedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trend, sparkline, sparkColor, progress,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  sparkline?: number[];
  sparkColor?: string;
  progress?: number;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
        {trend === "up" && <ArrowUpRight01Icon size={13} className="text-[var(--accent)]" />}
        {trend === "flat" && <MinusSignIcon size={13} className="text-[var(--muted-foreground)]" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] font-extrabold tracking-tight text-[var(--foreground)] leading-none">{value}</p>
        {sparkline && <Sparkline data={sparkline} color={sparkColor ?? "var(--accent)"} />}
      </div>
      {progress !== undefined && (
        <div className="h-0.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      {sub && <p className="text-[11px] text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}
