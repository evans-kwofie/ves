import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Loading03Icon,
  Mail01Icon,
  Linkedin01Icon,
  InstagramIcon,
  Copy01Icon,
} from "hugeicons-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon, PencilEdit02Icon, LinkSquare01Icon } from "@hugeicons/core-free-icons";
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
  const [copied, setCopied] = React.useState(false);

  const isLinkedIn = draft.channel === "linkedin";
  const isInstagram = draft.channel === "instagram";
  const isSocial = isLinkedIn || isInstagram;

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: isSocial ? null : subject.trim(), body: body.trim() }),
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

  async function markSent() {
    setApproving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_sent" }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: CampaignDraft; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to mark as sent"); return; }
      onUpdate(data.draft!);
      toast.success("Marked as sent");
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

  async function copyMessage() {
    await navigator.clipboard.writeText(draft.body);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card flex flex-col gap-3">
      {/* Channel badge */}
      <div className="flex justify-end">
        <span className="badge badge-gray inline-flex items-center gap-1">
          {isLinkedIn && <Linkedin01Icon size={11} />}
          {isInstagram && <InstagramIcon size={11} />}
          {!isSocial && <Mail01Icon size={11} />}
          {draft.channel}
        </span>
      </div>

      {/* Draft content */}
      {editing ? (
        <div className="flex flex-col gap-2">
          {!isSocial && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject</label>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
            </div>
          )}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Message</label>
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
            {isLinkedIn && (
              <p className="text-[11px] text-muted-foreground mt-1">{body.length} chars — LinkedIn DMs: 2,000 max · Connection notes: 300 max</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {!isSocial && draft.subject && (
            <p className="text-[13px] font-semibold">{draft.subject}</p>
          )}
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted rounded px-3 py-2">
            {draft.body}
          </p>
          {isSocial && (
            <p className="text-[11px] text-muted-foreground">{draft.body.length} chars{isInstagram ? " — keep under 1,000" : " — LinkedIn DMs: 2,000 max · Connection notes: 300 max"}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 pt-3 border-t border-border">
          {isSocial ? (
            <>
              <Button onClick={copyMessage} variant="outline">
                <Copy01Icon size={13} />
                {copied ? "Copied!" : "Copy"}
              </Button>
              {isLinkedIn && lead?.linkedin && (
                <Button variant="outline" onClick={() => window.open(lead.linkedin, "_blank", "noopener")}>
                  <HugeiconsIcon icon={LinkSquare01Icon} size={13} />
                  Open LinkedIn
                </Button>
              )}
              {isInstagram && (
                <Button variant="outline" onClick={() => window.open("https://www.instagram.com/direct/new/", "_blank", "noopener")}>
                  <HugeiconsIcon icon={LinkSquare01Icon} size={13} />
                  Open Instagram
                </Button>
              )}
              <Button onClick={markSent} disabled={approving || skipping}>
                {approving
                  ? <><Loading03Icon size={13} className="animate-spin" />Saving...</>
                  : <><HugeiconsIcon icon={SentIcon} size={13} />Mark as Sent</>}
              </Button>
            </>
          ) : (
            <Button onClick={approve} disabled={approving || skipping}>
              {approving
                ? <><Loading03Icon size={13} className="animate-spin" />Sending...</>
                : <><HugeiconsIcon icon={SentIcon} size={13} />Approve & Send</>}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <HugeiconsIcon icon={PencilEdit02Icon} size={13} />Edit
          </Button>
          <button
            className="btn btn-ghost btn-sm ml-auto text-muted-foreground"
            onClick={skip}
            disabled={skipping}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
