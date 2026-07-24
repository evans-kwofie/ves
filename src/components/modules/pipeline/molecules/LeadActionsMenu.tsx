import * as React from "react";
import {
  MoreHorizontalIcon,
  Mail01Icon,
  ArrowDiagonalIcon,
  PencilEdit01Icon,
  FlashIcon,
} from "hugeicons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import type { Lead, LeadStatus } from "~/types/lead";
import { timeAgo } from "~/utils/date";

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
  linkedin: "bg-accent-subtle text-accent",
  reply: "bg-emerald-500/10 text-emerald-400",
  deal: "bg-amber-500/10 text-amber-400",
};

interface LeadActionsMenuProps {
  lead: Lead;
  onChange: (lead: Lead) => void;
  orgId: string;
}

export function LeadActionsMenu({ lead, onChange, orgId }: LeadActionsMenuProps) {
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [editNotes, setEditNotes] = React.useState(lead.notes);
  const [editStatus, setEditStatus] = React.useState<LeadStatus>(lead.status);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);
  const [events, setEvents] = React.useState<OutreachEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  function openEmail() {
    setEmailSubject("");
    setEmailBody("");
    setEmailOpen(true);
  }

  async function openEdit() {
    setEditNotes(lead.notes);
    setEditStatus(lead.status);
    setEditOpen(true);
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/pipeline/leads/${lead.id}`);
      if (res.ok) setEvents((await res.json()) as OutreachEvent[]);
    } catch {
      /* silent */
    } finally {
      setEventsLoading(false);
    }
  }

  async function sendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          subject: emailSubject,
          body: emailBody,
          leadId: lead.id,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        toast.success("Email sent");
        onChange({
          ...lead,
          status: "email_sent",
          emailSentAt: new Date().toISOString(),
        });
        setEmailOpen(false);
      } else {
        toast.error(data.error ?? "Failed to send email");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
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
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setSaving(false);
    }
  }

  async function enrichLead() {
    setEnriching(true);
    try {
      const res = await fetch("/api/pipeline/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, leadId: lead.id }),
      });
      if (res.ok) {
        toast.success("Lead enriched");
        const refreshed = await fetch(`/api/pipeline/leads/${lead.id}`);
        if (refreshed.ok) onChange((await refreshed.json()) as Lead);
      } else {
        toast.error("Enrichment failed");
      }
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground cursor-pointer hover:text-foreground transition-colors outline-none">
              <MoreHorizontalIcon size={15} />
            </button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openEmail}>
            <Mail01Icon size={13} />
            Send email
          </DropdownMenuItem>
          {lead.linkedin && (
            <DropdownMenuItem
              onClick={() => window.open(lead.linkedin!, "_blank", "noopener,noreferrer")}
            >
              <ArrowDiagonalIcon size={13} />
              Open LinkedIn
            </DropdownMenuItem>
          )}
          {lead.pipelineStage === "discovered" && (
            <DropdownMenuItem onClick={enrichLead} disabled={enriching}>
              <FlashIcon size={13} />
              {enriching ? "Enriching..." : "Enrich lead"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openEdit}>
            <PencilEdit01Icon size={13} />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email to {lead.ceo}</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground mb-3">
            To: {lead.email}
          </p>
          <div className="form-group">
            <Label>Subject</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject line"
            />
          </div>
          <div className="form-group">
            <Label>Body</Label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Email body..."
              className="min-h-[160px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEmailOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={sendEmail}
              disabled={sending || !emailSubject.trim() || !emailBody.trim()}
            >
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {lead.company}</DialogTitle>
          </DialogHeader>
          {lead.fitReason && (
            <p className="text-[12px] text-muted-foreground bg-muted px-3 py-2 rounded">
              {lead.fitReason}
            </p>
          )}
          <div className="form-group">
            <Label>Status</Label>
            <select
              className="input"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
            >
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
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Internal notes..."
              className="min-h-[100px]"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Outreach History
            </p>
            {eventsLoading ? (
              <p className="text-[12px] text-muted-foreground">Loading...</p>
            ) : events.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No outreach recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2.5">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_COLOR[ev.channel] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {CHANNEL_LABEL[ev.channel] ?? ev.channel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(ev.sentAt ?? ev.repliedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

