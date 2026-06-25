import * as React from "react";
import { LeadRow } from "../molecules/LeadRow";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import {
  UserGroupIcon,
  AiMagicIcon,
  Target01Icon,
  Cancel01Icon,
  Delete02Icon,
  Loading03Icon,
} from "hugeicons-react";
import { toast } from "sonner";
import type { Lead, LeadStatus, FitRating, PipelineStage } from "~/types/lead";

interface LeadTableProps {
  leads: Lead[];
  onChange: (leads: Lead[]) => void;
  orgId: string;
  onBulkCampaign?: (ids: string[]) => void;
}

export function LeadTable({ leads, onChange, orgId, onBulkCampaign }: LeadTableProps) {
  const [search, setSearch] = React.useState("");
  const [fitFilter, setFitFilter] = React.useState<FitRating | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "ALL">("ALL");
  const [stageFilter, setStageFilter] = React.useState<PipelineStage | "ALL">("ALL");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [enriching, setEnriching] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.ceo.toLowerCase().includes(search.toLowerCase());
    const matchFit = fitFilter === "ALL" || l.fit === fitFilter;
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    const matchStage = stageFilter === "ALL" || l.pipelineStage === stageFilter;
    return matchSearch && matchFit && matchStatus && matchStage;
  });

  function handleLeadChange(updated: Lead) {
    onChange(leads.map((l) => (l.id === updated.id ? updated : l)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
  const enrichableIds = selectedLeads.filter((l) => l.pipelineStage === "discovered").map((l) => l.id);
  const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;
  const someChecked = selectedIds.size > 0 && !allChecked;

  async function handleBulkEnrich() {
    if (enrichableIds.length === 0) return;
    setEnriching(true);
    let enriched = 0;
    try {
      await Promise.all(
        enrichableIds.map(async (leadId) => {
          const res = await fetch("/api/pipeline/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: orgId, leadId }),
          });
          if (res.ok) enriched++;
        })
      );
      toast.success(`${enriched} lead${enriched !== 1 ? "s" : ""} enriched`);
      const refreshed = await fetch(`/api/pipeline/leads?orgId=${orgId}`).catch(() => null);
      if (refreshed?.ok) onChange(await refreshed.json() as Lead[]);
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) => fetch(`/api/pipeline/leads/${id}`, { method: "DELETE" }))
      );
      onChange(leads.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
    } catch {
      toast.error("Failed to delete leads");
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <div>
      <div className="filter-row">
        <Input
          placeholder="Search company, email, name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-60"
        />
        <select
          className="input max-w-35"
          value={fitFilter}
          onChange={(e) => setFitFilter(e.target.value as FitRating | "ALL")}
        >
          <option value="ALL">All Fit</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select
          className="input max-w-45"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "ALL")}
        >
          <option value="ALL">All Status</option>
          <option value="not_contacted">Not Contacted</option>
          <option value="email_sent">Emailed</option>
          <option value="linkedin_sent">LinkedIn DM</option>
          <option value="replied">Replied</option>
          <option value="call_scheduled">Call Scheduled</option>
          <option value="converted">Converted</option>
          <option value="not_interested">Not Interested</option>
        </select>
        <select
          className="input max-w-40"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as PipelineStage | "ALL")}
        >
          <option value="ALL">All Stages</option>
          <option value="discovered">Discovered</option>
          <option value="enriching">Enriching</option>
          <option value="enriched">Enriched</option>
          <option value="validated">Validated</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-[12px] text-muted-foreground ml-auto">
          {filtered.length} of {leads.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><UserGroupIcon size={32} /></div>
          <div>{leads.length === 0 ? "No leads yet." : "No leads match your filters."}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 accent-accent cursor-pointer"
                  />
                </th>
                <th>Company</th>
                <th>Contact</th>
                <th>Fit</th>
                <th>Status</th>
                <th>Stage</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  orgId={orgId}
                  onChange={handleLeadChange}
                  checked={selectedIds.has(lead.id)}
                  onToggle={() => toggleOne(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-card-border shadow-lg">
          <span className="text-[13px] font-semibold text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1.5">
            {enrichableIds.length > 0 && (
              <Button size="sm" variant="ghost" onClick={handleBulkEnrich} disabled={enriching}>
                {enriching
                  ? <Loading03Icon size={13} className="animate-spin" />
                  : <AiMagicIcon size={13} />}
                Enrich {enrichableIds.length}
              </Button>
            )}
            {onBulkCampaign && (
              <Button size="sm" variant="ghost" onClick={() => onBulkCampaign(Array.from(selectedIds))}>
                <Target01Icon size={13} />
                Add to Campaign
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Delete02Icon size={13} />
              Delete
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <Cancel01Icon size={13} />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${selectedIds.size} lead${selectedIds.size !== 1 ? "s" : ""}?`}
        description="This will permanently remove the selected leads and all their outreach history."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
