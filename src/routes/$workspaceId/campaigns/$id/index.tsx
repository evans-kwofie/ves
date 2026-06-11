import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { Button } from "~/components/ui/button";
import {
  ArrowLeft01Icon,
  SparklesIcon,
  Mail01Icon,
  CheckmarkBadge01Icon,
  Cancel01Icon,
  Edit01Icon,
  Delete02Icon,
  Loading03Icon,
} from "hugeicons-react";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listDrafts } from "~/db/queries/drafts";
import { toast } from "sonner";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";
import type { CampaignDraft } from "~/db/queries/drafts";

// ─── Server ──────────────────────────────────────────────────────────────────

const getCampaignDetail = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const [campaign, leads, drafts] = await Promise.all([
      getCampaign(id),
      getCampaignLeadsWithData(id),
      listDrafts(id),
    ]);
    if (!campaign) return null;
    return { campaign, leads, drafts };
  });

export const Route = createFileRoute("/$workspaceId/campaigns/$id/")({
  loader: ({ params }) => getCampaignDetail({ data: params.id }),
  component: CampaignDetailPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "queue" | "leads" | "results";

function CampaignDetailPage() {
  const initial = Route.useLoaderData();
  const { workspaceId, id } = Route.useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = React.useState<Campaign | null>(initial?.campaign ?? null);
  const [leads] = React.useState<Lead[]>(initial?.leads ?? []);
  const [drafts, setDrafts] = React.useState<CampaignDraft[]>(initial?.drafts ?? []);
  const [tab, setTab] = React.useState<Tab>("queue");
  const [generating, setGenerating] = React.useState(false);

  if (!campaign) {
    return (
      <div className="page-content">
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Campaign not found.</p>
      </div>
    );
  }

  const pending = drafts.filter((d) => d.status === "pending");
  const sent = drafts.filter((d) => d.status === "sent");
  const skipped = drafts.filter((d) => d.status === "skipped");

  async function generateDrafts() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/generate-drafts`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; generated?: number; total?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate drafts");
        return;
      }
      toast.success(`Generated ${data.generated} of ${data.total} drafts`);
      // Reload drafts
      const draftsRes = await fetch(`/api/campaigns/${id}/drafts`);
      const newDrafts = (await draftsRes.json()) as CampaignDraft[];
      setDrafts(newDrafts);
      setTab("queue");
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  function handleDraftUpdate(updated: CampaignDraft) {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  const statusBadge = {
    draft: "badge badge-gray",
    active: "badge badge-green",
    scheduled: "badge badge-blue",
    completed: "badge badge-purple",
  }[campaign.status] ?? "badge badge-gray";

  return (
    <>
      <Header
        title={campaign.name}
        subtitle={campaign.goal ?? "Outreach campaign"}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/$workspaceId/campaigns" params={{ workspaceId }}>
              <Button variant="ghost">
                <ArrowLeft01Icon size={14} />
                Campaigns
              </Button>
            </Link>
            <Button onClick={generateDrafts} disabled={generating || leads.length === 0}>
              {generating ? (
                <><Loading03Icon size={14} className="animate-spin" />Generating...</>
              ) : (
                <><SparklesIcon size={14} />Generate Drafts</>
              )}
            </Button>
          </div>
        }
      />

      <div className="page-content">
        {/* Stats row */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Leads</div>
            <div className="stat-value">{leads.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Review</div>
            <div className="stat-value">{pending.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sent</div>
            <div className="stat-value">{sent.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Replies</div>
            <div className="stat-value green">{campaign.replyCount}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-list">
          {([
            { value: "queue" as Tab, label: "Review Queue", count: pending.length },
            { value: "leads" as Tab, label: "Leads", count: leads.length },
            { value: "results" as Tab, label: "Results", count: sent.length },
          ]).map((t) => (
            <button
              key={t.value}
              className="tab-trigger"
              data-state={tab === t.value ? "active" : "inactive"}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, background: "var(--muted)", color: "var(--muted-foreground)", borderRadius: 4, padding: "1px 5px" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Review Queue */}
        {tab === "queue" && (
          <ReviewQueue
            drafts={pending}
            leads={leads}
            campaignId={id}
            onUpdate={handleDraftUpdate}
            onGenerate={generateDrafts}
            generating={generating}
          />
        )}

        {/* Leads */}
        {tab === "leads" && (
          <LeadsTab leads={leads} drafts={drafts} />
        )}

        {/* Results */}
        {tab === "results" && (
          <ResultsTab sent={sent} skipped={skipped} leads={leads} />
        )}
      </div>
    </>
  );
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

function ReviewQueue({
  drafts,
  leads,
  campaignId,
  onUpdate,
  onGenerate,
  generating,
}: {
  drafts: CampaignDraft[];
  leads: Lead[];
  campaignId: string;
  onUpdate: (d: CampaignDraft) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (drafts.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ marginBottom: 16 }}>
          {leads.length === 0
            ? "No leads in this campaign yet."
            : "No drafts pending review. Generate drafts to get started."}
        </div>
        {leads.length > 0 && (
          <Button onClick={onGenerate} disabled={generating}>
            <SparklesIcon size={13} />
            {generating ? "Generating..." : "Generate Drafts"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {drafts.map((draft) => {
        const lead = leads.find((l) => l.id === draft.leadId);
        return (
          <DraftCard
            key={draft.id}
            draft={draft}
            lead={lead ?? null}
            campaignId={campaignId}
            onUpdate={onUpdate}
          />
        );
      })}
    </div>
  );
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  lead,
  campaignId,
  onUpdate,
}: {
  draft: CampaignDraft;
  lead: Lead | null;
  campaignId: string;
  onUpdate: (d: CampaignDraft) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [subject, setSubject] = React.useState(draft.subject ?? "");
  const [body, setBody] = React.useState(draft.body);
  const [saving, setSaving] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [skipping, setSkipping] = React.useState(false);

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const updated = (await res.json()) as CampaignDraft;
      onUpdate(updated);
      setEditing(false);
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: CampaignDraft; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send");
        return;
      }
      onUpdate(data.draft!);
      toast.success(`Sent to ${lead?.email ?? "lead"}`);
    } catch {
      toast.error("Network error");
    } finally {
      setApproving(false);
    }
  }

  async function skip() {
    setSkipping(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: CampaignDraft };
      if (res.ok) onUpdate(data.draft!);
    } catch {
      toast.error("Network error");
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Lead row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{lead?.company ?? "Unknown"}</span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8 }}>
            {lead?.ceo} · {lead?.email}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span className="badge badge-gray" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Mail01Icon size={11} />
            {draft.channel}
          </span>
        </div>
      </div>

      {/* Draft content */}
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Subject</label>
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Body</label>
            <textarea
              className="input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.subject && (
            <div style={{ fontSize: 13, fontWeight: 600 }}>{draft.subject}</div>
          )}
          <div
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              background: "var(--muted)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
            }}
          >
            {draft.body}
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <Button onClick={approve} disabled={approving || skipping}>
            {approving ? (
              <><Loading03Icon size={13} className="animate-spin" />Sending...</>
            ) : (
              <><CheckmarkBadge01Icon size={13} />Approve & Send</>
            )}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Edit01Icon size={13} />
            Edit
          </Button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={skip}
            disabled={skipping}
            style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}
          >
            <Cancel01Icon size={13} />
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab({ leads, drafts }: { leads: Lead[]; drafts: CampaignDraft[] }) {
  if (leads.length === 0) {
    return <div className="empty-state">No leads added to this campaign.</div>;
  }

  const draftMap = new Map(drafts.map((d) => [d.leadId, d]));

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Fit</th>
            <th>Draft Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const draft = draftMap.get(lead.id);
            return (
              <tr key={lead.id}>
                <td style={{ fontWeight: 600 }}>{lead.company}</td>
                <td style={{ color: "var(--muted-foreground)" }}>{lead.ceo}</td>
                <td style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{lead.email || "—"}</td>
                <td>
                  {lead.fit && (
                    <span className={`badge badge-${lead.fit === "HIGH" ? "green" : lead.fit === "MEDIUM" ? "yellow" : "red"}`}>
                      {lead.fit}
                    </span>
                  )}
                </td>
                <td>
                  {!draft && <span className="badge badge-gray">No draft</span>}
                  {draft?.status === "pending" && <span className="badge badge-blue">Pending</span>}
                  {draft?.status === "sent" && <span className="badge badge-green">Sent</span>}
                  {draft?.status === "skipped" && <span className="badge badge-gray">Skipped</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

function ResultsTab({ sent, skipped, leads }: { sent: CampaignDraft[]; skipped: CampaignDraft[]; leads: Lead[] }) {
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  if (sent.length === 0 && skipped.length === 0) {
    return <div className="empty-state">No messages sent yet. Approve drafts in the Review Queue to start sending.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sent.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span className="card-title" style={{ margin: 0 }}>Sent ({sent.length})</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Subject</th>
                <th>Sent At</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((draft) => {
                const lead = leadMap.get(draft.leadId);
                return (
                  <tr key={draft.id}>
                    <td style={{ fontWeight: 600 }}>{lead?.company ?? "—"}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{lead?.ceo ?? "—"}</td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{draft.subject ?? "—"}</td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                      {draft.sentAt ? new Date(draft.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {skipped.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {skipped.length} lead{skipped.length !== 1 ? "s" : ""} skipped
        </div>
      )}
    </div>
  );
}
