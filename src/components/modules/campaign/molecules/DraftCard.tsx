import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  CheckmarkBadge01Icon,
  Cancel01Icon,
  Edit01Icon,
  Loading03Icon,
  Mail01Icon,
} from "hugeicons-react";
import { toast } from "sonner";
import type { CampaignDraft } from "~/db/queries/drafts";
import type { Lead } from "~/types/lead";

export function DraftCard({
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
      if (!res.ok) { toast.error(data.error ?? "Failed to send"); return; }
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
    <div className="card flex flex-col gap-3">
      {/* Channel badge */}
      <div className="flex justify-end">
        <span className="badge badge-gray inline-flex items-center gap-1">
          <Mail01Icon size={11} />
          {draft.channel}
        </span>
      </div>

      {/* Draft content */}
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Body</label>
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {draft.subject && <p className="text-[13px] font-semibold">{draft.subject}</p>}
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted rounded px-3 py-2">
            {draft.body}
          </p>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button onClick={approve} disabled={approving || skipping}>
            {approving
              ? <><Loading03Icon size={13} className="animate-spin" />Sending...</>
              : <><CheckmarkBadge01Icon size={13} />Approve & Send</>}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Edit01Icon size={13} />Edit
          </Button>
          <button
            className="btn btn-ghost btn-sm ml-auto text-muted-foreground"
            onClick={skip}
            disabled={skipping}
          >
            <Cancel01Icon size={13} />Skip
          </button>
        </div>
      )}
    </div>
  );
}
