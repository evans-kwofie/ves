import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getDashboardStats, getRecentLeads, getLeadGrowth, getDistinctSources } from "~/db/queries/leads";
import { getRedditPostCount, getRecentRedditActivity } from "~/db/queries/reddit";
import { listKeywords } from "~/db/queries/keywords";
import { listCampaigns } from "~/db/queries/campaigns";
import { getSessionFn } from "~/lib/session";
import { ArrowUpRight01Icon, MinusSignIcon } from "hugeicons-react";
import type { Lead } from "~/types/lead";
import { WelcomeDashboard } from "~/components/modules/WelcomeDashboard";
import { DateRangePicker, type DateRange } from "~/components/ui/date-range-picker";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };
const PERIOD_LABEL: Record<Period, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };

// ─── Server ───────────────────────────────────────────────────────────────────

const getDashboard = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    orgId: z.string(),
    period: z.string().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    source: z.string().optional(),
    fit: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { orgId, period = "7d", from, to, source, fit } = data;
    const days = PERIOD_DAYS[(period as Period)] ?? 7;
    const [session, leadStats, redditCount, keywords, campaigns, recentLeads, leadGrowth, recentActivity, availableSources] =
      await Promise.all([
        getSessionFn(),
        getDashboardStats(orgId),
        getRedditPostCount(orgId),
        listKeywords(orgId),
        listCampaigns(orgId),
        getRecentLeads(orgId, 12, { source, fit }),
        getLeadGrowth(orgId, days, { source, from, to }),
        getRecentRedditActivity(orgId, 4),
        getDistinctSources(orgId),
      ]);
    return {
      userName: session?.user.name ?? "",
      ...leadStats,
      redditPosts: redditCount,
      activeKeywords: keywords.filter((k) => k.isActive).length,
      hasCampaigns: campaigns.length > 0,
      hasKeywords: keywords.filter((k) => k.isActive).length > 0,
      recentLeads,
      leadGrowth,
      recentActivity,
      availableSources,
    };
  });

const searchSchema = z.object({
  period: z.enum(PERIODS).optional().catch("7d"),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  source: z.string().optional(),
  fit: z.string().optional(),
});

export const Route = createFileRoute("/$workspaceId/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    period: search.period ?? "7d",
    from: search.from,
    to: search.to,
    source: search.source,
    fit: search.fit,
  }),
  loader: ({ params, deps }) =>
    getDashboard({ data: { orgId: params.workspaceId, period: deps.period, from: deps.from, to: deps.to, source: deps.source, fit: deps.fit } }),
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
  const n = counts.length;

  const pts = counts.map((v, i) => ({
    x: PAD.left + (n > 1 ? (i / (n - 1)) * iW : iW / 2),
    y: PAD.top + iH - (v / max) * iH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${PAD.top + iH} L${pts[0].x},${PAD.top + iH} Z`;
  const yTicks = [0, Math.round(max / 2), max];

  const labelStep = Math.ceil(n / 7);
  const labelIndices = new Set(
    Array.from({ length: n }, (_, i) => i).filter((i) => i % labelStep === 0 || i === n - 1),
  );

  function fmtLabel(iso: string) {
    const d = new Date(iso);
    if (n <= 14) return d.toLocaleDateString("en", { weekday: "short" });
    return d.toLocaleDateString("en", { month: "short", day: "numeric" });
  }

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
      {n <= 14 && pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="var(--card)" strokeWidth="1.5" />
      ))}
      {pts.map((p, i) =>
        labelIndices.has(i) ? (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">
            {fmtLabel(data[i].date)}
          </text>
        ) : null,
      )}
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRangeLabel(range: DateRange) {
  if (!range.from) return "selected dates";
  const from = range.from.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const to = range.to?.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return to ? `${from} – ${to}` : from;
}

const INTENT_DOT: Record<string, string> = {
  buying: "bg-accent",
  pain: "bg-amber-400",
  discussion: "bg-muted-foreground",
  noise: "bg-muted-foreground",
};

const FIT_COLOR: Record<string, string> = {
  HIGH: "text-accent",
  MEDIUM: "text-amber-400",
  LOW: "text-muted-foreground",
};

// ─── Filter bar ───────────────────────────────────────────────────────────────

function DropdownFilter({
  triggerLabel,
  isActive,
  children,
}: {
  triggerLabel: React.ReactNode;
  isActive: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-md border text-[11px] font-medium transition-all select-none",
          isActive
            ? "border-accent/50 bg-accent-subtle text-accent"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80",
        ].join(" ")}
      >
        {triggerLabel}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="shrink-0 opacity-40 mt-px">
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[168px] bg-card border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 py-1 overflow-hidden">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}


function FilterBar({
  period,
  dateRange,
  onDateRangeChange,
  source,
  fit,
  availableSources,
  workspaceId,
}: {
  period: Period;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  source: string | undefined;
  fit: string | undefined;
  availableSources: string[];
  workspaceId: string;
}) {
  const hasActiveFilters = !!source || (!!fit && fit !== "ALL");
  const activeFit = fit && fit !== "ALL" ? fit : undefined;

  const sourceLabel = source ? capitalize(source) : "All sources";
  const fitLabel = fit && fit !== "ALL" ? capitalize(fit.toLowerCase()) : "All scores";

  const sourceOptions = [
    { value: "", label: "All sources" },
    ...availableSources.map((s) => ({ value: s, label: capitalize(s) })),
  ];

  const fitOptions = [
    { value: "ALL", label: "All scores" },
    { value: "HIGH", label: "High" },
    { value: "MEDIUM", label: "Medium" },
    { value: "LOW", label: "Low" },
  ];
  const rangeSearch = dateRange?.from && dateRange.to
    ? { from: dateKey(dateRange.from), to: dateKey(dateRange.to) }
    : { period };

  return (
    <div className="flex items-center gap-2.5">
      <DateRangePicker value={dateRange} onChange={onDateRangeChange} placeholder="Select date range" className="h-7.5 min-w-0 text-[11px]" />

      <div className="w-px h-4 bg-border shrink-0" />

      {/* Source dropdown */}
      {availableSources.length > 0 && (
        <DropdownFilter
          isActive={!!source}
          triggerLabel={
            <>
              <span className="text-muted-foreground/50 font-normal">Source</span>
              <span className={source ? "font-semibold" : ""}>{sourceLabel}</span>
            </>
          }
        >
          {(close) => (
            <>
              {sourceOptions.map((opt) => (
                <Link
                  key={opt.value}
                  to="/$workspaceId"
                  params={{ workspaceId }}
                  search={{ ...rangeSearch, source: opt.value || undefined, fit: activeFit }}
                  onClick={close}
                  className={[
                    "flex items-center gap-2.5 w-full px-3 py-1.75 text-[12px] transition-colors no-underline",
                    (source ?? "") === opt.value
                      ? "text-accent"
                      : "text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <span className={`w-3.5 text-[9px] shrink-0 ${(source ?? "") === opt.value ? "opacity-100" : "opacity-0"}`}>✓</span>
                  {opt.label}
                </Link>
              ))}
            </>
          )}
        </DropdownFilter>
      )}

      {/* Fit dropdown */}
      <DropdownFilter
        isActive={!!fit && fit !== "ALL"}
        triggerLabel={
          <>
            <span className="text-muted-foreground/50 font-normal">Fit</span>
            <span className={fit && fit !== "ALL" ? "font-semibold" : ""}>{fitLabel}</span>
          </>
        }
      >
        {(close) => (
          <>
            {fitOptions.map((opt) => (
              <Link
                key={opt.value}
                to="/$workspaceId"
                params={{ workspaceId }}
                search={{ ...rangeSearch, source: source || undefined, fit: opt.value !== "ALL" ? opt.value : undefined }}
                onClick={close}
                className={[
                  "flex items-center gap-2.5 w-full px-3 py-1.75 text-[12px] transition-colors no-underline",
                  (fit ?? "ALL") === opt.value
                    ? "text-accent"
                    : "text-foreground hover:bg-muted",
                ].join(" ")}
              >
                <span className={`w-3.5 text-[9px] shrink-0 ${(fit ?? "ALL") === opt.value ? "opacity-100" : "opacity-0"}`}>✓</span>
                {opt.label}
              </Link>
            ))}
          </>
        )}
      </DropdownFilter>

      {/* Reset */}
      {hasActiveFilters && (
        <>
          <div className="w-px h-4 bg-border shrink-0" />
          <Link
            to="/$workspaceId"
            params={{ workspaceId }}
            search={rangeSearch}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            Reset
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const data = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const { period = "7d", from, to, source, fit } = Route.useSearch();
  const navigate = Route.useNavigate();

  const isEmpty = data.totalLeads === 0 && !data.hasCampaigns && !data.hasKeywords;

  if (isEmpty) {
    return (
      <div className="page-content">
        <WelcomeDashboard
          workspaceId={workspaceId}
          userName={data.userName}
          hasLeads={data.totalLeads > 0}
          hasCampaigns={data.hasCampaigns}
          hasKeywords={data.hasKeywords}
        />
      </div>
    );
  }

  const convRate = data.totalLeads > 0
    ? ((data.converted / data.totalLeads) * 100).toFixed(1)
    : "0.0";
  const growthCounts = data.leadGrowth.map((d) => d.count);
  const totalInPeriod = growthCounts.reduce((a, b) => a + b, 0);
  const resolvedPeriod = (period as Period) ?? "7d";
  const dateRange = React.useMemo<DateRange>(() => {
    if (from && to) return { from: new Date(`${from}T00:00:00`), to: new Date(`${to}T00:00:00`) };
    const to = new Date();
    const start = new Date(to);
    start.setDate(to.getDate() - (PERIOD_DAYS[resolvedPeriod] - 1));
    return { from: start, to };
  }, [from, to, resolvedPeriod]);

  function handleDateRangeChange(range: DateRange | undefined) {
    void navigate({
      to: "/$workspaceId",
      params: { workspaceId },
      search: {
        period: range?.from && range.to ? undefined : resolvedPeriod,
        from: range?.from && range.to ? dateKey(range.from) : undefined,
        to: range?.from && range.to ? dateKey(range.to) : undefined,
        source,
        fit,
      },
    });
  }

  return (
    <div className="page-content flex flex-col gap-6">

      {/* Greeting + filter bar */}
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            {greeting(data.userName)}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Here's what's happening across your pipeline today.
          </p>
        </div>
        <FilterBar
          period={resolvedPeriod}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          source={source}
          fit={fit}
          availableSources={data.availableSources}
          workspaceId={workspaceId}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={fmt(data.totalLeads)}
          sub={`+${totalInPeriod} in ${formatRangeLabel(dateRange)}`}
          trend={totalInPeriod > 0 ? "up" : "flat"}
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Lead Growth</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                New leads per day — {formatRangeLabel(dateRange)}
                {source ? ` · ${capitalize(source)}` : ""}
              </p>
            </div>
          </div>
          <LeadGrowthChart data={data.leadGrowth} />
        </div>

        <div className="card p-5 flex flex-col gap-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-foreground">Live Activity</p>
            <span className="text-[10px] font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded-full">LIVE</span>
          </div>

          {data.recentActivity.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No signals yet. Fetch some Reddit posts.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.recentActivity.map((item) => (
                <div key={item.id} className="flex gap-2.5 items-start">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${INTENT_DOT[item.intentType ?? ""] ?? "bg-muted-foreground"}`} />
                  <div className="min-w-0">
                    <p className="text-[12px] text-foreground leading-snug truncate">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">r/{item.subreddit} · {timeAgo(item.fetchedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/$workspaceId/reddit"
            params={{ workspaceId }}
            className="text-[11px] font-semibold text-accent no-underline mt-auto pt-4 tracking-wide"
          >
            VIEW ALL SIGNALS →
          </Link>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Recent Leads</p>
            {(source || (fit && fit !== "ALL")) && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Filtered
                {source ? ` · ${capitalize(source)}` : ""}
                {fit && fit !== "ALL" ? ` · ${capitalize(fit.toLowerCase())} fit` : ""}
              </p>
            )}
          </div>
          <Link to="/$workspaceId/pipeline" params={{ workspaceId }} className="text-[11px] font-semibold text-accent no-underline">
            View all →
          </Link>
        </div>

        {data.recentLeads.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            {source || fit
              ? "No leads match the current filters."
              : "No leads yet. Run the Reddit agent to auto-discover leads."}
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Company", "Contact", "Fit", "Status", "Source", "Added"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-2.5 border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentLeads.map((lead: Lead) => (
                <tr key={lead.id} className="border-b border-border last:border-b-0">
                  <td className="py-2.5 pr-4 text-[12px] font-semibold text-foreground">{lead.company}</td>
                  <td className="py-2.5 pr-4 text-[12px] text-muted-foreground">{lead.ceo}</td>
                  <td className="py-2.5 pr-4">
                    {lead.fit
                      ? <span className={`text-[10px] font-bold uppercase tracking-wide ${FIT_COLOR[lead.fit] ?? "text-muted-foreground"}`}>{lead.fit}</span>
                      : <span className="text-[11px] text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                      {lead.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[11px] text-muted-foreground capitalize">
                    {lead.source ?? "—"}
                  </td>
                  <td className="py-2.5 text-[11px] text-muted-foreground">{timeAgo(lead.addedAt)}</td>
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
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        {trend === "up" && <ArrowUpRight01Icon size={13} className="text-accent" />}
        {trend === "flat" && <MinusSignIcon size={13} className="text-muted-foreground" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] font-extrabold tracking-tight text-foreground leading-none">{value}</p>
        {sparkline && <Sparkline data={sparkline} color={sparkColor ?? "var(--accent)"} />}
      </div>
      {progress !== undefined && (
        <div className="h-0.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
