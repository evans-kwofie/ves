import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { Button } from "~/components/ui/button";
import {
  ArrowLeft01Icon,
  Mail01Icon,
  CheckmarkBadge01Icon,
  Cancel01Icon,
  Edit01Icon,
  Delete02Icon,
  Loading03Icon,
  Add01Icon,
  Linkedin01Icon,
  SparklesIcon,
  PencilEdit01Icon,
  InformationCircleIcon,
} from "hugeicons-react";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listDrafts } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import type { CampaignStep } from "~/db/queries/steps";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { ComposeDraftPanel } from "~/components/modules/campaign/ComposeDraftPanel";
import { useComposeDraft } from "~/store/compose-draft";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { EmailSignature } from "~/types/signature";
import { toast } from "sonner";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";
import type { CampaignDraft } from "~/db/queries/drafts";

// ─── Server ──────────────────────────────────────────────────────────────────

const getCampaignDetail = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const headers = getRequestHeaders();
    const [campaign, leads, drafts, steps, orgs] = await Promise.all([
      getCampaign(id),
      getCampaignLeadsWithData(id),
      listDrafts(id),
      listSteps(id),
      auth.api.listOrganizations({ headers }).catch(() => []),
    ]);
    if (!campaign) return null;
    let signatures: EmailSignature[] = [];
    try {
      const org = orgs?.[0];
      const meta = org?.metadata ? JSON.parse(org.metadata as string) : {};
      signatures = (meta.emailSignatures as EmailSignature[]) ?? [];
    } catch {}
    return { campaign, leads, drafts, steps, signatures };
  });

export const Route = createFileRoute("/$workspaceId/campaigns/$id/")({
  loader: ({ params }) => getCampaignDetail({ data: params.id }),
  component: CampaignDetailPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "queue" | "leads" | "results" | "sequence";

function CampaignDetailPage() {
  const initial = Route.useLoaderData();
  const { workspaceId, id } = Route.useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = React.useState<Campaign | null>(initial?.campaign ?? null);
  const [leads] = React.useState<Lead[]>(initial?.leads ?? []);
  const [drafts, setDrafts] = React.useState<CampaignDraft[]>(initial?.drafts ?? []);
  const [steps, setSteps] = React.useState<CampaignStep[]>(initial?.steps ?? []);
  const [tab, setTab] = React.useState<Tab>("sequence");
  const openCompose = useComposeDraft((s) => s.open);

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

  function handleDraftUpdate(updated: CampaignDraft) {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleDraftAdded(draft: CampaignDraft) {
    setDrafts((prev) => [...prev, draft]);
    setTab("queue");
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
          <Link to="/$workspaceId/campaigns" params={{ workspaceId }}>
            <Button variant="ghost">
              <ArrowLeft01Icon size={14} />
              Campaigns
            </Button>
          </Link>
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
            { value: "sequence" as Tab, label: "Sequence", count: steps.length },
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
            signatures={initial?.signatures ?? []}
            onUpdate={handleDraftUpdate}
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

        {/* Sequence */}
        {tab === "sequence" && (
          <SequenceTab campaignId={id} steps={steps} onStepsChange={setSteps} />
        )}
      </div>

      <ComposeDraftPanel onDraftAdded={handleDraftAdded} />
    </>
  );
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

function ReviewQueue({
  drafts,
  leads,
  campaignId,
  signatures,
  onUpdate,
}: {
  drafts: CampaignDraft[];
  leads: Lead[];
  campaignId: string;
  signatures: EmailSignature[];
  onUpdate: (d: CampaignDraft) => void;
}) {
  const [generating, setGenerating] = React.useState(false);
  const openCompose = useComposeDraft((s) => s.open);

  async function handleAiGen() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-drafts`, { method: "POST" });
      const data = (await res.json()) as { generated?: number; total?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      toast.success(`Generated ${data.generated} of ${data.total} drafts`);
      const newDrafts = (await fetch(`/api/campaigns/${campaignId}/drafts`).then((r) => r.json())) as CampaignDraft[];
      newDrafts.forEach(onUpdate);
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Action row */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={handleAiGen} disabled={generating || leads.length === 0}>
          {generating
            ? <><Loading03Icon size={13} className="animate-spin" /> Generating...</>
            : <><SparklesIcon size={13} /> AI Generate</>}
        </Button>
        <Button
          variant="ghost"
          disabled={leads.length === 0}
          onClick={() => openCompose({ campaignId, leads, signatures })}
        >
          <PencilEdit01Icon size={13} />
          Manually Draft
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="empty-state">
          {leads.length === 0
            ? "No leads in this campaign yet."
            : "No drafts pending review. Use AI Generate or Manually Draft above."}
        </div>
      ) : (
        drafts.map((draft) => {
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
        })
      )}
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

// ─── Sequence Tab ─────────────────────────────────────────────────────────────

const CHANNEL_META = {
  email: { label: "Email", icon: <Mail01Icon size={14} /> },
  linkedin: { label: "LinkedIn", icon: <Linkedin01Icon size={14} /> },
} as const;

function StepPopover({
  step,
  campaignId,
  onUpdate,
  onDelete,
}: {
  step: CampaignStep;
  campaignId: string;
  onUpdate: (s: CampaignStep) => void;
  onDelete: (id: string) => void;
}) {
  const [channel, setChannel] = React.useState<"email" | "linkedin">(step.channel as "email" | "linkedin");
  const [delay, setDelay] = React.useState(step.delayDays);
  const [context, setContext] = React.useState(step.context ?? "");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, delayDays: delay, context: context || null }),
      });
      const updated = (await res.json()) as CampaignStep;
      onUpdate(updated);
    } catch {
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
      onDelete(step.id);
    } catch {
      toast.error("Failed to delete step");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        className="btn btn-ghost btn-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Edit01Icon size={13} />
      </PopoverTrigger>
      <PopoverContent side="right" className="w-64 flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold text-foreground">Edit step</p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Channel</label>
          <select className="input text-[12px]" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin")}>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Send on day</label>
          <input type="number" min={0} className="input text-[12px]" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI context hint</label>
          <textarea
            className="input text-[12px] resize-none"
            rows={3}
            placeholder="e.g. Reference their recent funding round, mention a specific pain point, keep it short and genuine..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground" style={{ lineHeight: 1.5 }}>
            Guides the AI on tone and angle for this specific step.
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loading03Icon size={12} className="animate-spin" /> : "Save"}
          </Button>
          <button
            className="btn btn-ghost btn-sm text-red-400 ml-auto"
            onClick={remove}
            disabled={deleting}
          >
            {deleting ? <Loading03Icon size={12} className="animate-spin" /> : <Delete02Icon size={13} />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SequenceTab({
  campaignId,
  steps,
  onStepsChange,
}: {
  campaignId: string;
  steps: CampaignStep[];
  onStepsChange: (steps: CampaignStep[]) => void;
}) {
  function handleUpdate(updated: CampaignStep) {
    onStepsChange(steps.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleDelete(id: string) {
    onStepsChange(
      steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 }))
    );
  }

  const SPINE_WIDTH = 28;

  return (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
      {steps.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "36px 0 24px", textAlign: "center" }}>
          <InformationCircleIcon size={26} style={{ color: "var(--muted-foreground)", opacity: 0.35 }} />
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No steps yet</p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 20px", maxWidth: 340, lineHeight: 1.65 }}>
            A sequence controls when and how each outreach is sent. Start with an email on Day 0, then add follow-ups spaced a few days apart.
          </p>
        </div>
      )}

      {steps.map((step, i) => {
        const meta = CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.email;
        const next = steps[i + 1];
        const waitDays = next != null ? next.delayDays - step.delayDays : null;

        return (
          <React.Fragment key={step.id}>
            {/* Step row — no card wrapper, just inline text + actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Circle */}
              <div style={{
                width: SPINE_WIDTH, height: SPINE_WIDTH, flexShrink: 0,
                borderRadius: "50%", background: "var(--accent-subtle)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>
                {i + 1}
              </div>
              {/* Content */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  {meta.icon}
                  {meta.label}
                </div>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", flexShrink: 0 }}>
                  {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                </span>
                {step.context && (
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    "{step.context}"
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto", flexShrink: 0 }}>
                  <StepPopover step={step} campaignId={campaignId} onUpdate={handleUpdate} onDelete={handleDelete} />
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Delete step"
                    onClick={async () => {
                      try {
                        await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
                        handleDelete(step.id);
                      } catch {
                        toast.error("Failed to delete step");
                      }
                    }}
                  >
                    <Delete02Icon size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dashed connector + wait label */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: SPINE_WIDTH, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                <div style={{ borderLeft: "1.5px dashed var(--border)", height: waitDays != null ? 40 : 20 }} />
              </div>
              {waitDays != null && (
                <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                  Wait {waitDays} day{waitDays !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Add step popover button */}
      <AddStepPopover campaignId={campaignId} steps={steps} onAdd={(step) => onStepsChange([...steps, step])} />
    </div>
  );
}

function AddStepPopover({
  campaignId,
  steps,
  onAdd,
}: {
  campaignId: string;
  steps: CampaignStep[];
  onAdd: (step: CampaignStep) => void;
}) {
  const lastDelay = steps[steps.length - 1]?.delayDays ?? -1;
  const [channel, setChannel] = React.useState<"email" | "linkedin">("email");
  const [delay, setDelay] = React.useState(lastDelay < 0 ? 0 : lastDelay + 3);
  const [context, setContext] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    const last = steps[steps.length - 1]?.delayDays ?? -1;
    setDelay(last < 0 ? 0 : last + 3);
  }, [steps.length]);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNumber: steps.length + 1, delayDays: delay, channel, context: context.trim() || null }),
      });
      const step = (await res.json()) as CampaignStep;
      onAdd(step);
      setOpen(false);
      setContext("");
    } catch {
      toast.error("Failed to add step");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius)",
        background: "transparent",
        color: "var(--muted-foreground)",
        fontSize: 12, cursor: "pointer",
      }}>
        <Add01Icon size={13} />
        Add step
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold text-foreground">New step</p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Channel</label>
          <select className="input text-[12px]" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin")}>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Send on day</label>
          <input type="number" min={0} className="input text-[12px]" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI context hint</label>
          <textarea
            className="input text-[12px] resize-none"
            rows={3}
            placeholder={steps.length === 0
              ? "e.g. Introduce us, mention what we do, keep it short and curious..."
              : "e.g. Follow up on the first email, softer tone, mention a specific use case..."}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground" style={{ lineHeight: 1.5 }}>
            This tells the AI what angle to take when generating a draft for this step.
          </p>
        </div>

        <Button size="sm" onClick={handleAdd} disabled={adding}>
          {adding ? <Loading03Icon size={12} className="animate-spin" /> : <Add01Icon size={12} />}
          Add Step
        </Button>
      </PopoverContent>
    </Popover>
  );
}
