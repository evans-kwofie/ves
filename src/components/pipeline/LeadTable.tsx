import * as React from "react";
import { LeadRow } from "./LeadRow";
import { Input } from "~/components/ui/input";
import { Users } from "lucide-react";
import type { Lead, LeadStatus, FitRating } from "~/types/lead";

interface LeadTableProps {
  leads: Lead[];
  onChange: (leads: Lead[]) => void;
}

export function LeadTable({ leads, onChange }: LeadTableProps) {
  const [search, setSearch] = React.useState("");
  const [fitFilter, setFitFilter] = React.useState<FitRating | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "ALL">("ALL");

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

  return (
    <div>
      <div className="filter-row">
        <Input
          placeholder="Search company, email, name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
        <select
          className="input"
          style={{ maxWidth: 140 }}
          value={fitFilter}
          onChange={(e) => setFitFilter(e.target.value as FitRating | "ALL")}
        >
          <option value="ALL">All Fit</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select
          className="input"
          style={{ maxWidth: 180 }}
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
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: "auto" }}>
          {filtered.length} of {leads.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={32} />
          </div>
          <div>{leads.length === 0 ? "No leads yet." : "No leads match your filters."}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Fit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onChange={handleLeadChange} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
