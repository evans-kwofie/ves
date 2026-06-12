import * as React from "react";
import { LeadRow } from "../molecules/LeadRow";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { UserGroupIcon, AiMagicIcon, Target01Icon, Cancel01Icon } from "hugeicons-react";
import type { Lead, LeadStatus, FitRating } from "~/types/lead";

interface LeadTableProps {
  leads: Lead[];
  onChange: (leads: Lead[]) => void;
  onBulkEnrich?: (ids: string[]) => void;
  onBulkCampaign?: (ids: string[]) => void;
}

export function LeadTable({ leads, onChange, onBulkEnrich, onBulkCampaign }: LeadTableProps) {
  const [search, setSearch] = React.useState("");
  const [fitFilter, setFitFilter] = React.useState<FitRating | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "ALL">("ALL");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.ceo.toLowerCase().includes(search.toLowerCase());
    const matchFit = fitFilter === "ALL" || l.fit === fitFilter;
    const matchStatus = statusFilter === "ALL" || l.status === statusFilter;
    return matchSearch && matchFit && matchStatus;
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

  const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;
  const someChecked = selectedIds.size > 0 && !allChecked;
  const enrichableSelected = filtered.filter((l) => selectedIds.has(l.id) && l.pipelineStage === "discovered").length;

  return (
    <div>
      <div className="filter-row">
        <Input
          placeholder="Search company, email, name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[240px]"
        />
        <select
          className="input max-w-[140px]"
          value={fitFilter}
          onChange={(e) => setFitFilter(e.target.value as FitRating | "ALL")}
        >
          <option value="ALL">All Fit</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select
          className="input max-w-[180px]"
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
        <span className="text-[12px] text-[var(--muted-foreground)] ml-auto">
          {filtered.length} of {leads.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded bg-accent-subtle border border-accent/30">
          <span className="text-[13px] font-semibold text-accent">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            {enrichableSelected > 0 && onBulkEnrich && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onBulkEnrich(filtered.filter((l) => selectedIds.has(l.id)).map((l) => l.id))}
              >
                <AiMagicIcon size={13} />
                Enrich {enrichableSelected}
              </Button>
            )}
            {onBulkCampaign && (
              <Button
                size="sm"
                onClick={() => onBulkCampaign(Array.from(selectedIds))}
              >
                <Target01Icon size={13} />
                Create Campaign
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <Cancel01Icon size={13} />
            </Button>
          </div>
        </div>
      )}

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
                  onChange={handleLeadChange}
                  checked={selectedIds.has(lead.id)}
                  onToggle={() => toggleOne(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
