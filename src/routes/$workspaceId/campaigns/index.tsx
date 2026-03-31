import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { Button } from "~/components/ui/button";
import {
  Add01Icon,
  Mail01Icon,
  Linkedin01Icon,
  Delete02Icon,
  PlayIcon,
  Target01Icon,
} from "hugeicons-react";
import { listCampaigns } from "~/db/queries/campaigns";
import { OutputLog } from "~/components/agent/OutputLog";
import { toast } from "sonner";
import type { Campaign, CampaignStatus, RunFrequency } from "~/types/campaign";

const getCampaignsData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listCampaigns(orgId));

export const Route = createFileRoute("/$workspaceId/campaigns/")({
  loader: ({ params }) => getCampaignsData({ data: params.workspaceId }),
  component: CampaignsPage,
});

const STATUS_TABS: { label: string; value: CampaignStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Drafts", value: "draft" },
  { label: "Completed", value: "completed" },
];

const STATUS_BADGE: Record<CampaignStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge badge-gray" },
  active: { label: "Active", cls: "badge badge-green" },
  scheduled: { label: "Scheduled", cls: "badge badge-blue" },
  completed: { label: "Completed", cls: "badge badge-purple" },
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail01Icon size={13} />,
  linkedin: <Linkedin01Icon size={13} />,
  both: (
    <span className="flex gap-1">
      <Mail01Icon size={13} />
      <Linkedin01Icon size={13} />
    </span>
  ),
};

const FREQUENCY_LABELS: Record<RunFrequency, string> = {
  daily: "Daily",
  every_3_days: "Every 3 days",
  weekly: "Weekly",
};

function replyRate(sent: number, replies: number) {
  if (sent === 0) return "—";
  return `${Math.round((replies / sent) * 100)}%`;
}

// ─── Run log dialog ───────────────────────────────────────────────────────────
function RunDialog({
  campaign,
  onClose,
  onRan,
}: {
  campaign: Campaign;
  onClose: () => void;
  onRan: (id: string) => void;
}) {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleRun() {
    setRunning(true);
    setLogs([]);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/run`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; logs?: string[]; error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "Failed to run campaign");
        setLogs([data.message ?? data.error ?? "Error"]);
      } else {
        setLogs(data.logs ?? []);
        toast.success("Campaign run complete");
        onRan(campaign.id);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(false);
      setDone(true);
    }
  }

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog-content" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 16 }}>
          <p className="dialog-title">Run Campaign</p>
          <p className="dialog-description">
            {campaign.name} · {campaign.leadCount} lead{campaign.leadCount !== 1 ? "s" : ""}
            {campaign.goal ? ` · ${campaign.goal}` : ""}
          </p>
        </div>

        {!running && !done && (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
            The AI agent will send outreach to all uncontacted leads in this campaign, follow up on any that haven't replied in 3+ days, and log every action back to the pipeline.
          </p>
        )}

        <OutputLog logs={logs} />

        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={running}>
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <Button onClick={handleRun} disabled={running}>
              {running ? (
                <><span className="spinner" />Running...</>
              ) : (
                <><PlayIcon size={13} />Run Now</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────────
function CampaignCard({
  campaign,
  onDelete,
  onStatusChange,
  onFrequencyChange,
  onRunOpen,
}: {
  campaign: Campaign;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onFrequencyChange: (id: string, freq: RunFrequency | null) => void;
  onRunOpen: (campaign: Campaign) => void;
}) {
  const [deleting, setDeleting] = React.useState(false);
  const badge = STATUS_BADGE[campaign.status];

  async function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      onDelete(campaign.id);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeleting(false);
    }
  }

  async function handleActivate() {
    const next: CampaignStatus = campaign.status === "active" ? "draft" : "active";
    try {
      await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(campaign.id, next);
    } catch {
      toast.error("Failed to update campaign");
    }
  }

  async function handleFrequencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as RunFrequency | "";
    const freq = val === "" ? null : val;
    try {
      await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runFrequency: freq }),
      });
      onFrequencyChange(campaign.id, freq);
    } catch {
      toast.error("Failed to update schedule");
    }
  }

  const lastRun = campaign.lastRunAt
    ? new Date(campaign.lastRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{campaign.name}</span>
            <span className={badge.cls}>{badge.label}</span>
            {campaign.channel && (
              <span className="badge badge-gray" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {CHANNEL_ICON[campaign.channel]}
                {campaign.channel}
              </span>
            )}
          </div>
          {campaign.goal && (
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
              {campaign.goal}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleActivate}>
            {campaign.status === "active" ? "Pause" : "Activate"}
          </button>
          <Button onClick={() => onRunOpen(campaign)}>
            <PlayIcon size={13} />
            Run
          </Button>
          <button className="btn btn-ghost btn-sm" onClick={handleDelete} disabled={deleting} title="Delete">
            <Delete02Icon size={13} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 20, borderTop: "1px solid var(--border)", paddingTop: 12, flexWrap: "wrap" }}>
        <div>
          <div className="stat-label">Leads</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>{campaign.leadCount}</div>
        </div>
        <div>
          <div className="stat-label">Sent</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>{campaign.sentCount}</div>
        </div>
        <div>
          <div className="stat-label">Replies</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>{campaign.replyCount}</div>
        </div>
        <div>
          <div className="stat-label">Reply Rate</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              marginTop: 2,
              color: campaign.replyCount > 0 ? "var(--accent)" : undefined,
            }}
          >
            {replyRate(campaign.sentCount, campaign.replyCount)}
          </div>
        </div>

        {/* Schedule selector */}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <div className="stat-label">Auto-run</div>
          <select
            className="input text-[12px]"
            value={campaign.runFrequency ?? ""}
            onChange={handleFrequencyChange}
            style={{ padding: "3px 24px 3px 8px", fontSize: 12, height: "auto" }}
          >
            <option value="">Manual only</option>
            {(Object.entries(FREQUENCY_LABELS) as [RunFrequency, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {lastRun && (
            <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Last run {lastRun}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function CampaignsPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>(initial);
  const [tab, setTab] = React.useState<CampaignStatus | "all">("all");
  const [runTarget, setRunTarget] = React.useState<Campaign | null>(null);

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalReplies = campaigns.reduce((s, c) => s + c.replyCount, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  function handleDelete(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function handleStatusChange(id: string, status: CampaignStatus) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  function handleFrequencyChange(id: string, freq: RunFrequency | null) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, runFrequency: freq } : c)));
  }

  function handleRan(id: string) {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lastRunAt: new Date().toISOString() } : c))
    );
  }

  return (
    <>
      <Header
        title="Campaigns"
        subtitle="Manage outreach sequences and track their performance."
        actions={
          <Link to="/$workspaceId/campaigns/new" params={{ workspaceId }}>
            <Button>
              <Add01Icon size={14} />
              New Campaign
            </Button>
          </Link>
        }
      />
      <div className="page-content">
        {/* Aggregate stats */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Campaigns</div>
            <div className="stat-value">{campaigns.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value">{activeCampaigns}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Sent</div>
            <div className="stat-value">{totalSent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Replies</div>
            <div className="stat-value green">{totalReplies}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Reply Rate</div>
            <div className="stat-value">{replyRate(totalSent, totalReplies)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-list">
          {STATUS_TABS.map((t) => {
            const count = t.value === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.value).length;
            return (
              <button
                key={t.value}
                className="tab-trigger"
                data-state={tab === t.value ? "active" : "inactive"}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                {count > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, background: "var(--muted)", color: "var(--muted-foreground)", borderRadius: 4, padding: "1px 5px" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Campaign cards */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ marginBottom: 16 }}>
              {tab === "all"
                ? "No campaigns yet. Create your first campaign to start tracking outreach sequences."
                : `No ${tab} campaigns.`}
            </div>
            {tab === "all" && (
              <Link to="/$workspaceId/campaigns/new" params={{ workspaceId }}>
                <button className="btn btn-primary btn-sm">
                  <Add01Icon size={13} />
                  New Campaign
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onFrequencyChange={handleFrequencyChange}
                onRunOpen={setRunTarget}
              />
            ))}
          </div>
        )}

        {/* AI insights panel */}
        {campaigns.length > 0 && totalSent > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Target01Icon size={15} style={{ color: "var(--accent)" }} />
              <span className="card-title" style={{ margin: 0 }}>AI Insights</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              {totalReplies === 0
                ? "No replies yet. Keep sending — the first reply usually comes within 3–5 days of initial outreach."
                : `Your campaigns are averaging a ${replyRate(totalSent, totalReplies)} reply rate across ${totalSent} sent messages. ${
                    totalReplies / totalSent > 0.1
                      ? "That's above average — keep using the same tone and timing."
                      : "Try personalising the opening line with something specific to each lead's company."
                  }`}
            </p>
          </div>
        )}
      </div>

      {/* Run dialog */}
      {runTarget && (
        <RunDialog
          campaign={runTarget}
          onClose={() => setRunTarget(null)}
          onRan={(id) => { handleRan(id); }}
        />
      )}
    </>
  );
}
