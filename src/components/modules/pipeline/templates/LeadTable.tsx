import * as React from "react";
import { LeadRow } from "../molecules/LeadRow";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { EmptyState } from "~/components/ui/empty-state";
import {
  UserGroupIcon,
  FlashIcon,
  Target01Icon,
  Cancel01Icon,
  Delete02Icon,
  Loading03Icon,
  FilterIcon,
} from "hugeicons-react";
import { toast } from "sonner";
import type { Lead, LeadStatus, FitRating, PipelineStage } from "~/types/lead";
import { filterPriorityQueue, type LeadPriorityQueue } from "~/lib/lead-priority";

function sourceLabel(source: string): string {
  return source.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const KNOWN_SOURCES = ["instagram", "linkedin", "reddit"];

interface LeadTableProps {
  leads: Lead[];
  onChange: (leads: Lead[]) => void;
  orgId: string;
  onBulkCampaign?: (ids: string[]) => void;
}

export function LeadTable({ leads, onChange, orgId, onBulkCampaign }: LeadTableProps) {
  const [search, setSearch] = React.useState("");
  const [fitFilter, setFitFilter] = React.useState<FitRating | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "ALL">("ALL");
  const [stageFilter, setStageFilter] = React.useState<PipelineStage | "ALL">("ALL");
  const [verificationFilter, setVerificationFilter] = React.useState<"ALL" | "verified" | "needs_attention">("ALL");
  const [freshnessFilter, setFreshnessFilter] = React.useState<"ALL" | "fresh" | "stale">("ALL");
  const [priorityQueue, setPriorityQueue] = React.useState<LeadPriorityQueue | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [enriching, setEnriching] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const hasQueuedEnrichment = leads.some((lead) => lead.pipelineStage === "enriching");
  const availableSources = React.useMemo(
    () => [
      ...KNOWN_SOURCES,
      ...Array.from(new Set(leads.flatMap((lead) => lead.source?.trim() ? [lead.source.trim()] : [])))
        .filter((source) => !KNOWN_SOURCES.includes(source))
        .sort(),
    ],
    [leads],
  );
  const hasManualLeads = leads.some((lead) => !lead.source?.trim());
  const activeFilterCount = [fitFilter, sourceFilter, statusFilter, stageFilter, verificationFilter, freshnessFilter].filter((filter) => filter !== "ALL").length;

  React.useEffect(() => {
    if (!hasQueuedEnrichment) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/pipeline/leads?orgId=${orgId}`)
        .then((response) => response.ok ? response.json() as Promise<Lead[]> : null)
        .then((refreshed) => { if (refreshed) onChange(refreshed); })
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasQueuedEnrichment, orgId, onChange]);

  const priorityLeads = priorityQueue ? filterPriorityQueue(leads, priorityQueue) : leads;
  const filtered = priorityLeads.filter((l) => {
    const matchSearch =
      !search ||
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.ceo.toLowerCase().includes(search.toLowerCase());
    const matchFit = fitFilter === "ALL" || l.fit === fitFilter;
    const normalizedSource = l.source?.trim() || null;
    const matchSource = sourceFilter === "ALL"
      || (sourceFilter === "manual" ? normalizedSource === null : normalizedSource === sourceFilter);
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    const matchStage = stageFilter === "ALL" || l.pipelineStage === stageFilter;
    const matchVerification = verificationFilter === "ALL" || (verificationFilter === "verified" ? l.isValid === true : l.isValid !== true);
    const freshnessDate = l.enrichedAt ?? l.lastVerifiedAt ?? l.addedAt;
    const isFresh = Date.now() - new Date(freshnessDate).getTime() < 30 * 86400000;
    const matchFreshness = freshnessFilter === "ALL" || (freshnessFilter === "fresh" ? isFresh : !isFresh);
    return matchSearch && matchFit && matchSource && matchStatus && matchStage && matchVerification && matchFreshness;
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
    onChange(leads.map((lead) =>
      enrichableIds.includes(lead.id) ? { ...lead, pipelineStage: "enriching" } : lead,
    ));
    const toastId = toast.loading(`Researching ${enrichableIds.length} lead${enrichableIds.length === 1 ? "" : "s"}...`);
    let enriched = 0;
    let failed = 0;
    try {
      await Promise.all(
        enrichableIds.map(async (leadId) => {
          const res = await fetch("/api/pipeline/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: orgId, leadId }),
          });
          if (res.ok) {
            const data = (await res.json()) as { queued?: number; enriched?: number; failed?: number };
            enriched += data.queued ?? 0;
            enriched += data.enriched ?? 0;
            failed += data.failed ?? 0;
          }
        })
      );
      if (failed > 0) {
        toast.error(`${failed} lead${failed !== 1 ? "s" : ""} could not be enriched — add details and retry.`, { id: toastId });
      } else {
        toast.success(`${enriched} lead${enriched !== 1 ? "s" : ""} queued for background enrichment`, { id: toastId });
      }
      const refreshed = await fetch(`/api/pipeline/leads?orgId=${orgId}`).catch(() => null);
      if (refreshed?.ok) onChange(await refreshed.json() as Lead[]);
    } catch {
      toast.error("Enrichment failed", { id: toastId });
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
        <Button className="ml-auto" size="sm" variant="outline" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
          <FilterIcon size={14} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>
      <div className="filter-row mt-2" aria-label="Lead priority queues">
        {([
          ["highest_fit", "Highest fit"],
          ["stale", "Stale"],
          ["verification_needed", "Verification needed"],
        ] as const).map(([queue, label]) => (
          <Button key={queue} size="sm" variant={priorityQueue === queue ? "default" : "outline"} onClick={() => setPriorityQueue((current) => current === queue ? null : queue)}>
            {label} ({filterPriorityQueue(leads, queue).length})
          </Button>
        ))}
      </div>
      {filtersOpen && <div className="filter-row mt-2 rounded-lg border border-border bg-muted/30 p-3">
        <select
          className="input max-w-35"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          aria-label="Filter by lead source"
        >
          <option value="ALL">All Sources</option>
          {hasManualLeads && <option value="manual">Manual</option>}
          {availableSources.map((source) => (
            <option key={source} value={source}>{sourceLabel(source)}</option>
          ))}
        </select>
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
          <option value="instagram_sent">Instagram DM</option>
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
          <option value="enrichment_failed">Enrichment Failed</option>
          <option value="failed">Failed</option>
        </select>
        <select className="input max-w-40" value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value as typeof verificationFilter)} aria-label="Filter by verification">
          <option value="ALL">All Verification</option>
          <option value="verified">Verified</option>
          <option value="needs_attention">Needs Attention</option>
        </select>
        <select className="input max-w-35" value={freshnessFilter} onChange={(e) => setFreshnessFilter(e.target.value as typeof freshnessFilter)} aria-label="Filter by freshness">
          <option value="ALL">All Freshness</option>
          <option value="fresh">Fresh</option>
          <option value="stale">Stale</option>
        </select>
      </div>}

      {filtered.length === 0 ? (
        <EmptyState
          icon={leads.length === 0 ? <UserGroupIcon /> : <FilterIcon />}
          title={leads.length === 0 ? "No leads yet" : "No leads match your filters"}
          description={leads.length === 0 ? "Add your first lead to start building your pipeline." : "Try adjusting your filters."}
        />
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
                <th>Source</th>
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
                  : <FlashIcon size={13} />}
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
