import * as React from "react";
import type { Lead, PipelineMeta } from "~/types/lead";

interface PipelineStatsProps {
  leads: Lead[];
  meta: PipelineMeta;
}

export function PipelineStats({ leads, meta }: PipelineStatsProps) {
  const stats = [
    { label: "Total Leads", value: leads.length },
    {
      label: "Not Contacted",
      value: leads.filter((l) => l.status === "not_contacted").length,
    },
    { label: "Emailed", value: leads.filter((l) => l.status === "email_sent").length },
    { label: "Replied", value: leads.filter((l) => l.status === "replied").length },
    { label: "Converted", value: leads.filter((l) => l.status === "converted").length },
    { label: "Emails Sent", value: meta.totalEmailsSent, green: true },
  ];

  return (
    <div className="stat-grid" style={{ marginBottom: 20 }}>
      {stats.map((s) => (
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className={`stat-value${s.green ? " green" : ""}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
