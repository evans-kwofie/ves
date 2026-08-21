import * as React from "react";
import {
  MoreHorizontalIcon,
  Mail01Icon,
  ArrowDiagonalIcon,
  PencilEdit01Icon,
  FlashIcon,
} from "hugeicons-react";
import { CopyIcon, EyeIcon, Globe2Icon } from "lucide-react";
import { LeadDetailsSheet } from "./LeadDetailsSheet";
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
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import type { Lead, LeadStatus } from "~/types/lead";

interface OutreachEvent {
  id: string;
  channel: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
}

interface EnrichmentAttempt {
  id: string;
  attemptNumber: number;
  status: "succeeded" | "retrying" | "failed";
  summary: string | null;
  error: string | null;
  createdAt: string;
}

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
  const [editCompany, setEditCompany] = React.useState(lead.company);
  const [editContact, setEditContact] = React.useState(lead.ceo);
  const [editEmail, setEditEmail] = React.useState(lead.email);
  const [editWebsite, setEditWebsite] = React.useState(lead.website);
  const [editLinkedin, setEditLinkedin] = React.useState(lead.linkedin);
  const [editDescription, setEditDescription] = React.useState(lead.whatTheyDo);
  const [sending, setSending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsLead, setDetailsLead] = React.useState<Lead>(lead);
  const [detailsEvents, setDetailsEvents] = React.useState<OutreachEvent[]>([]);
  const [detailsEnrichmentAttempts, setDetailsEnrichmentAttempts] = React.useState<EnrichmentAttempt[]>([]);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [confirmRiskyEmail, setConfirmRiskyEmail] = React.useState(false);

  async function openDetails() {
    setDetailsLead(lead);
    setDetailsEvents([]);
    setDetailsEnrichmentAttempts([]);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/pipeline/leads/${lead.id}?include=events`);
      if (res.ok) {
        const data = (await res.json()) as { lead: Lead; events: OutreachEvent[]; enrichmentAttempts: EnrichmentAttempt[] };
        setDetailsLead(data.lead);
        setDetailsEvents(data.events);
        setDetailsEnrichmentAttempts(data.enrichmentAttempts);
      }
    } catch {
      toast.error("Could not load lead details");
    } finally {
      setDetailsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!detailsOpen || detailsLead.pipelineStage !== "enriching") return;
    const timer = window.setInterval(() => { void openDetails(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [detailsOpen, detailsLead.pipelineStage]);

  function openEmail() {
    setEmailSubject("");
    setEmailBody("");
    setEmailOpen(true);
  }

  function openExternalUrl(url: string) {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copyEmail() {
    if (!lead.email) return;
    try {
      await navigator.clipboard.writeText(lead.email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
  }

  function openEdit() {
    setEditNotes(lead.notes);
    setEditStatus(lead.status);
    setEditCompany(lead.company);
    setEditContact(lead.ceo);
    setEditEmail(lead.email);
    setEditWebsite(lead.website);
    setEditLinkedin(lead.linkedin);
    setEditDescription(lead.whatTheyDo);
    setEditOpen(true);
  }

  async function sendEmail(allowRiskyEmail = false) {
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
          allowRiskyEmail,
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
      } else if (data.error === "accept_all_requires_confirmation") {
        setConfirmRiskyEmail(true);
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
        body: JSON.stringify({
          company: editCompany,
          ceo: editContact,
          email: editEmail.trim() || null,
          website: editWebsite,
          linkedin: editLinkedin,
          whatTheyDo: editDescription,
          notes: editNotes,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const failure = (await res.json().catch(() => null)) as {
          error?: string;
          issues?: { field: string; code: string; message: string }[];
        } | null;
        console.error("[lead-update-validation] Update request rejected", {
          leadId: lead.id,
          status: res.status,
          error: failure?.error,
          issues: failure?.issues,
        });
        const message = failure?.issues?.[0]?.message ?? "Failed to update lead";
        throw new Error(message);
      }
      const updated = (await res.json()) as Lead;
      onChange(updated);
      toast.success("Lead updated");
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update lead");
    } finally {
      setSaving(false);
    }
  }

  async function enrichLead() {
    setEnriching(true);
    onChange({ ...lead, pipelineStage: "enriching" });
    const toastId = toast.loading("Researching company, contact channels, and ICP fit...");
    try {
      const res = await fetch("/api/pipeline/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, leadId: lead.id }),
      });
      if (res.ok) {
        const outcome = (await res.json()) as { queued?: number; enriched?: number; failed?: number };
        if ((outcome.queued ?? 0) > 0) {
          toast.success("Lead enrichment queued — this will continue in the background.", { id: toastId });
        } else
        if ((outcome.failed ?? 0) > 0) {
          toast.error("We couldn't verify enough details. Add what you know and try again.", { id: toastId });
        } else {
          toast.success("Lead enrichment complete", { id: toastId });
        }
        const refreshed = await fetch(`/api/pipeline/leads/${lead.id}`);
        if (refreshed.ok) onChange((await refreshed.json()) as Lead);
      } else {
        onChange(lead);
        toast.error("Enrichment failed", { id: toastId });
      }
    } catch {
      onChange(lead);
      toast.error("Enrichment failed", { id: toastId });
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
        <DropdownMenuContent align="end" className="sm:min-w-44">
          <DropdownMenuItem onClick={openDetails}>
            <EyeIcon size={13} />
            View details
          </DropdownMenuItem>
          {lead.email && (
            <>
              <DropdownMenuItem onClick={openEmail}>
                <Mail01Icon size={13} />
                Send email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyEmail}>
                <CopyIcon size={13} />
                Copy email
              </DropdownMenuItem>
            </>
          )}
          {lead.website && (
            <DropdownMenuItem onClick={() => openExternalUrl(lead.website!)}>
              <Globe2Icon size={13} />
              Open website
            </DropdownMenuItem>
          )}
          {lead.linkedin && (
            <DropdownMenuItem
              onClick={() => openExternalUrl(lead.linkedin!)}
            >
              <ArrowDiagonalIcon size={13} />
              Open LinkedIn
            </DropdownMenuItem>
          )}
          {lead.pipelineStage !== "enriching" && (
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

      <LeadDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        lead={detailsLead}
        events={detailsEvents}
        enrichmentAttempts={detailsEnrichmentAttempts}
        loading={detailsLoading}
        onEdit={() => { setDetailsOpen(false); openEdit(); }}
      />

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
        <DialogContent className="sm:min-w-2xl max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-3 pr-12">
            <DialogTitle>Edit {lead.company}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-4">
          {lead.fitReason && (
            <p className="text-[12px] text-muted-foreground bg-muted px-3 py-2 rounded">
              {lead.fitReason}
            </p>
          )}
          {lead.isValid === false && lead.validationErrors.length > 0 && (
            <p className="text-[12px] text-red-400 bg-red-500/10 px-3 py-2 rounded">
              {lead.validationErrors.join(". ")}
            </p>
          )}
          <div className="two-col">
            <div className="form-group">
              <Label>Company</Label>
              <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
            </div>
            <div className="form-group">
              <Label>Contact</Label>
              <Input value={editContact} onChange={(e) => setEditContact(e.target.value)} />
            </div>
          </div>
          <div className="two-col">
            <div className="form-group">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="form-group">
              <Label>Website or profile URL</Label>
              <Input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="form-group">
            <Label>LinkedIn URL</Label>
            <Input value={editLinkedin} onChange={(e) => setEditLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="form-group">
            <Label>What they do</Label>
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[72px]" />
          </div>
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
              <option value="instagram_sent">Instagram DM</option>
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
      <ConfirmDialog open={confirmRiskyEmail} onOpenChange={setConfirmRiskyEmail} title="Send to a catch-all address?" description="This domain accepts every address, so the recipient cannot be fully verified. Sending may increase bounce risk." confirmLabel="Send anyway" loading={sending} onConfirm={() => { setConfirmRiskyEmail(false); void sendEmail(true); }} />
    </>
  );
}
