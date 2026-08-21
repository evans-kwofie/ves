import * as React from "react";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
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
import { checkDraftQuality } from "~/lib/draft-quality";

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
  const [confirmRiskySend, setConfirmRiskySend] = React.useState(false);

  const isLinkedIn = draft.channel === "linkedin";
  const isLinkedInConnect = draft.channel === "linkedin_connect";
  const isInstagram = draft.channel === "instagram";
  const isSocial = isLinkedIn || isLinkedInConnect || isInstagram;
  const CONNECT_LIMIT = 300;
  const qualityIssues = checkDraftQuality({ body, channel: draft.channel, prospect: { company: lead?.company, firstName: lead?.ceo?.split(/\s+/)[0], whatTheyDo: lead?.whatTheyDo } });

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
      const data = (await res.json()) as { ok?: boolean; draft?: CampaignDraft; error?: string; message?: string };
      if (!res.ok) { toast.error(data.message ?? data.error ?? "Failed to approve"); return; }
      onUpdate(data.draft!);
      toast.success("Draft approved and ready to send");
    } catch {
      toast.error("Network error");
    } finally {
      setApproving(false);
    }
  }

  async function send(allowRiskyEmail = false) {
    setApproving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", allowRiskyEmail }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: CampaignDraft; error?: string; message?: string };
      if (!res.ok) {
        if (data.error === "accept_all_requires_confirmation") setConfirmRiskySend(true);
        else toast.error(data.message ?? data.error ?? "Failed to send");
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
      {/* Channel */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground capitalize">
          {(isLinkedIn || isLinkedInConnect) && <Linkedin01Icon size={11} />}
          {isInstagram && <InstagramIcon size={11} />}
          {!isSocial && <Mail01Icon size={11} />}
          {isLinkedInConnect ? "LinkedIn Connect" : draft.channel}
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
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={isLinkedInConnect ? 4 : 6} />
            {isLinkedInConnect && (
              <p className={`text-[11px] mt-1 ${body.length > CONNECT_LIMIT ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                {body.length} / {CONNECT_LIMIT} chars{body.length > CONNECT_LIMIT ? " — over limit, LinkedIn will reject this" : ""}
              </p>
            )}
            {isLinkedIn && (
              <p className="text-[11px] text-muted-foreground mt-1">{body.length} chars</p>
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
          {isLinkedInConnect && (
            <p className={`text-[11px] ${draft.body.length > CONNECT_LIMIT ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
              {draft.body.length} / {CONNECT_LIMIT} chars{draft.body.length > CONNECT_LIMIT ? " — over limit" : ""}
            </p>
          )}
          {isLinkedIn && (
            <p className="text-[11px] text-muted-foreground">{draft.body.length} chars</p>
          )}
          {isInstagram && (
            <p className="text-[11px] text-muted-foreground">{draft.body.length} chars — keep under 1,000</p>
          )}
        </div>
      )}

      {qualityIssues.length > 0 && !editing && (
        <p className="text-[11px] text-amber-500">Check: {qualityIssues.join(" · ")}</p>
      )}
      {Boolean(draft.generationContext.whatTheyDo) && !editing && (
        <p className="text-[11px] text-muted-foreground">Based on: {String(draft.generationContext.whatTheyDo)}</p>
      )}
      {Boolean(draft.generationContext.selectedProduct) && !editing && (
        <p className="text-[11px] text-muted-foreground">Offer: {String(draft.generationContext.selectedProduct)}{draft.generationContext.productMatchReason ? ` — ${String(draft.generationContext.productMatchReason)}` : ""}</p>
      )}
      {draft.status === "failed" && !editing && (
        <p className="text-[11px] text-destructive">The last send failed. Review the draft and try again.</p>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 pt-3 border-t border-border">
          {draft.status === "sending" ? (
            <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground"><Loading03Icon size={14} className="animate-spin" />Sending…</span>
          ) : (
            <>
          {isSocial ? (
            <>
              <Button onClick={copyMessage} variant="outline">
                <Copy01Icon size={13} />
                {copied ? "Copied!" : "Copy"}
              </Button>
              {(isLinkedIn || isLinkedInConnect) && lead?.linkedin && (
                <Button variant="outline" onClick={() => window.open(lead.linkedin, "_blank", "noopener")}>
                  <HugeiconsIcon icon={LinkSquare01Icon} size={13} />
                  {isLinkedInConnect ? "Open Profile" : "Open LinkedIn"}
                </Button>
              )}
              {isInstagram && (
                <Button variant="outline" disabled={!lead?.website} onClick={() => lead?.website && window.open(lead.website, "_blank", "noopener,noreferrer")}>
                  <HugeiconsIcon icon={LinkSquare01Icon} size={13} />
                  Open Profile
                </Button>
              )}
              <Button onClick={markSent} disabled={approving || skipping}>
                {approving
                  ? <><Loading03Icon size={13} className="animate-spin" />Saving...</>
                  : <><HugeiconsIcon icon={SentIcon} size={13} />{isLinkedInConnect ? "Mark as Sent" : "Mark as Sent"}</>}
              </Button>
            </>
          ) : (
            <Button onClick={draft.status === "approved" ? send : approve} disabled={approving || skipping}>
              {approving
                ? <><Loading03Icon size={13} className="animate-spin" />Sending...</>
                : <><HugeiconsIcon icon={SentIcon} size={13} />{draft.status === "approved" ? "Send now" : draft.status === "failed" ? "Approve retry" : "Approve"}</>}
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
            </>
          )}
        </div>
      )}
      <ConfirmDialog open={confirmRiskySend} onOpenChange={setConfirmRiskySend} title="Send to a catch-all address?" description="This domain accepts every address, so the recipient cannot be fully verified. Sending may increase bounce risk." confirmLabel="Send anyway" loading={approving} onConfirm={() => { setConfirmRiskySend(false); void send(true); }} />
    </div>
  );
}
