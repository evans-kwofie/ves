import * as React from "react";
import { LeadStatusBadge } from "../atoms/LeadStatusBadge";
import { LeadActionsMenu } from "./LeadActionsMenu";
import type { Lead } from "~/types/lead";

const FIT_CLASS: Record<string, string> = {
  HIGH: "text-accent",
  MEDIUM: "text-amber-400",
  LOW: "text-muted-foreground",
};

const STAGE_CLASS: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  enriching: "bg-blue-500/10 text-blue-400",
  enriched: "bg-accent-subtle text-accent",
  validated: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

interface LeadRowProps {
  lead: Lead;
  onChange: (lead: Lead) => void;
  orgId: string;
  checked?: boolean;
  onToggle?: () => void;
}

export function LeadRow({ lead, onChange, orgId, checked = false, onToggle }: LeadRowProps) {
  const daysSinceEmail = lead.emailSentAt
    ? Math.floor((Date.now() - new Date(lead.emailSentAt).getTime()) / 86400000)
    : null;

  return (
    <tr className={checked ? "bg-accent-subtle" : undefined}>
      <td className="w-10">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-3.5 h-3.5 accent-accent cursor-pointer"
        />
      </td>
      <td>
        <div className="font-semibold text-[13px]">{lead.company}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-50">
          {lead.whatTheyDo?.slice(0, 60)}
        </div>
      </td>
      <td>
        <div className="text-[13px]">{lead.ceo}</div>
        <div className="text-[11px] text-muted-foreground">{lead.email}</div>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <span className={`text-[11px] font-bold uppercase tracking-wide ${FIT_CLASS[lead.fit] ?? "text-muted-foreground"}`}>
            {lead.fit ?? "—"}
          </span>
          {lead.score !== null && (
            <span className="text-[10px] text-muted-foreground">{lead.score}/100</span>
          )}
        </div>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <LeadStatusBadge status={lead.status} />
          {daysSinceEmail !== null && (
            <span className="text-[10px] text-muted-foreground">{daysSinceEmail}d ago</span>
          )}
        </div>
      </td>
      <td>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STAGE_CLASS[lead.pipelineStage] ?? STAGE_CLASS.discovered}`}>
          {lead.pipelineStage}
        </span>
      </td>
      <td>
        <LeadActionsMenu lead={lead} onChange={onChange} orgId={orgId} />
      </td>
    </tr>
  );
}
