import * as React from "react";
import { Mail01Icon, ArrowDiagonalIcon, PencilEdit01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import type { Lead, LeadStatus } from "~/types/lead";

interface OutreachEvent {
  id: string;
  channel: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email sent",
  linkedin: "LinkedIn DM sent",
  reply: "Reply received",
  deal: "Converted",
};

const CHANNEL_COLOR: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-400",
  linkedin: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  reply: "bg-emerald-500/10 text-emerald-400",
  deal: "bg-amber-500/10 text-amber-400",
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FIT_CLASS: Record<string, string> = {
  HIGH: "text-[var(--accent)]",
  MEDIUM: "text-amber-400",
  LOW: "text-[var(--muted-foreground)]",
};

const STAGE_CLASS: Record<string, string> = {
  discovered: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  enriching: "bg-blue-500/10 text-blue-400",
  enriched: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  validated: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

interface LeadRowProps {
  lead: Lead;
  onChange: (lead: Lead) => void;
}

export function LeadRow({ lead, onChange }: LeadRowProps) {
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [editNotes, setEditNotes] = React.useState(lead.notes);
  const [editStatus, setEditStatus] = React.useState<LeadStatus>(lead.status);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [events, setEvents] = React.useState<OutreachEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  async function openEdit() {
    setEditNotes(lead.notes);
    setEditStatus(lead.status);
    setEditOpen(true);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/pipeline/leads/${lead.id}`);
      if (res.ok) setEvents((await res.json()) as OutreachEvent[]);
    } catch { /* silent */ }
    finally { setEventsLoading(false); }
  }

  async function sendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lead.email, subject: emailSubject, body: emailBody, leadId: lead.id }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        toast.success("Email sent");
        onChange({ ...lead, status: "email_sent", emailSentAt: new Date().toISOString() });
        setEmailOpen(false);
      } else {
        toast.error(data.error ?? "Failed to send email");
      }
    } catch { toast.error("Failed to send email"); }
    finally { setSending(false); }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pipeline/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editNotes, status: editStatus }),
      });
      const updated = (await res.json()) as Lead;
      onChange(updated);
      toast.success("Lead updated");
      setEditOpen(false);
    } catch { toast.error("Failed to update lead"); }
    finally { setSaving(false); }
  }

  const daysSinceEmail = lead.emailSentAt
    ? Math.floor((Date.now() - new Date(lead.emailSentAt).getTime()) / 86400000)
    : null;

  return (
    <>
      <tr>
        <td>
          <div className="font-semibold text-[13px] text-[var(--foreground)]">{lead.company}</div>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 truncate max-w-[200px]">
            {lead.whatTheyDo?.slice(0, 60)}
          </div>
        </td>
        <td>
          <div className="text-[13px] text-[var(--foreground)]">{lead.ceo}</div>
          <div className="text-[11px] text-[var(--muted-foreground)]">{lead.email}</div>
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <span className={`text-[11px] font-bold uppercase tracking-wide ${FIT_CLASS[lead.fit] ?? "text-[var(--muted-foreground)]"}`}>
              {lead.fit ?? "—"}
            </span>
            {lead.score !== null && (
              <span className="text-[10px] text-[var(--muted-foreground)]">{lead.score}/100</span>
            )}
          </div>
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <LeadStatusBadge status={lead.status} />
            {daysSinceEmail !== null && (
              <span className="text-[10px] text-[var(--muted-foreground)]">{daysSinceEmail}d ago</span>
            )}
          </div>
        </td>
        <td>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STAGE_CLASS[lead.pipelineStage] ?? STAGE_CLASS.discovered}`}>
            {lead.pipelineStage}
          </span>
        </td>
        <td>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setEmailSubject(""); setEmailBody(""); setEmailOpen(true); }} title="Send email">
              <Mail01Icon size={13} />
            </Button>
            {lead.linkedin && (
              <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex">
                <Button variant="ghost" size="sm" title="LinkedIn"><ArrowDiagonalIcon size={13} /></Button>
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={openEdit} title="Edit">
              <PencilEdit01Icon size={13} />
            </Button>
          </div>
        </td>
      </tr>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Email to {lead.ceo}</DialogTitle></DialogHeader>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-3">To: {lead.email}</p>
          <div className="form-group">
            <Label>Subject</Label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject line" />
          </div>
          <div className="form-group">
            <Label>Body</Label>
            <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Email body..." className="min-h-[160px]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={sendEmail} disabled={sending || !emailSubject.trim() || !emailBody.trim()}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {lead.company}</DialogTitle></DialogHeader>
          {lead.fitReason && (
            <p className="text-[12px] text-[var(--muted-foreground)] bg-[var(--muted)] px-3 py-2 rounded-[var(--radius)]">
              {lead.fitReason}
            </p>
          )}
          <div className="form-group">
            <Label>Status</Label>
            <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value as LeadStatus)}>
              <option value="not_contacted">Not Contacted</option>
              <option value="email_sent">Email Sent</option>
              <option value="linkedin_sent">LinkedIn DM</option>
              <option value="replied">Replied</option>
              <option value="call_scheduled">Call Scheduled</option>
              <option value="converted">Converted</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>
          <div className="form-group">
            <Label>Notes</Label>
            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Internal notes..." className="min-h-[100px]" />
          </div>

          {/* Outreach timeline */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Outreach History</p>
            {eventsLoading ? (
              <p className="text-[12px] text-[var(--muted-foreground)]">Loading...</p>
            ) : events.length === 0 ? (
              <p className="text-[12px] text-[var(--muted-foreground)]">No outreach recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLOR[ev.channel] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                      {CHANNEL_LABEL[ev.channel] ?? ev.channel}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {timeAgo(ev.sentAt ?? ev.repliedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
