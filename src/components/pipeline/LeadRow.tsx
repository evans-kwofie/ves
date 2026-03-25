import * as React from "react";
import { Mail, ExternalLink, Edit2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import type { Lead, LeadStatus } from "~/types/lead";

const FIT_COLORS: Record<string, string> = {
  HIGH: "var(--accent)",
  MEDIUM: "#facc15",
  LOW: "var(--muted-foreground)",
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
        onChange({ ...lead, status: "email_sent", emailSentAt: new Date().toISOString() });
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

  const daysSinceEmail = lead.emailSentAt
    ? Math.floor((Date.now() - new Date(lead.emailSentAt).getTime()) / 86400000)
    : null;

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{lead.company}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {lead.whatTheyDo.slice(0, 60)}
          </div>
        </td>
        <td>
          <div style={{ fontSize: 13 }}>{lead.ceo}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{lead.email}</div>
        </td>
        <td>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: FIT_COLORS[lead.fit] ?? "var(--muted-foreground)",
            }}
          >
            {lead.fit}
          </span>
        </td>
        <td>
          <LeadStatusBadge status={lead.status} />
          {daysSinceEmail !== null && (
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3 }}>
              {daysSinceEmail}d ago
            </div>
          )}
        </td>
        <td>
          <div style={{ display: "flex", gap: 4 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmailSubject("");
                setEmailBody("");
                setEmailOpen(true);
              }}
              title="Send email"
            >
              <Mail size={13} />
            </Button>
            {lead.linkedin && (
              <a
                href={lead.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex" }}
              >
                <Button variant="ghost" size="sm" title="LinkedIn">
                  <ExternalLink size={13} />
                </Button>
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditNotes(lead.notes);
                setEditStatus(lead.status);
                setEditOpen(true);
              }}
              title="Edit"
            >
              <Edit2 size={13} />
            </Button>
          </div>
        </td>
      </tr>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email to {lead.ceo}</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
            To: {lead.email}
          </div>
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
              style={{ minHeight: 160 }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={sending}>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {lead.company}</DialogTitle>
          </DialogHeader>
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
              style={{ minHeight: 100 }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
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
