import * as React from "react";
import { InstagramIcon, Linkedin01Icon, Pen01Icon, RedditIcon } from "hugeicons-react";
import { LeadStatusBadge } from "../atoms/LeadStatusBadge";
import { LeadActionsMenu } from "./LeadActionsMenu";
import { FitIndicator } from "~/components/ui/fit-indicator";
import type { Lead } from "~/types/lead";

const STAGE_CLASS: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  enriching: "bg-blue-500/10 text-blue-400",
  enriched: "bg-accent-subtle text-accent",
  validated: "bg-emerald-500/10 text-emerald-400",
  enrichment_failed: "bg-amber-400/10 text-amber-400",
  failed: "bg-red-500/10 text-red-400",
};

function sourceLabel(source: string | null): string {
  if (!source) return "Manual";
  return source.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function LeadSourceIcon({ source }: { source: string | null }) {
  const props = { size: 16, strokeWidth: 1.8, "aria-hidden": true };
  if (source === "instagram") return <InstagramIcon {...props} />;
  if (source === "linkedin") return <Linkedin01Icon {...props} />;
  if (source === "reddit") return <RedditIcon {...props} />;
  return <Pen01Icon {...props} />;
}

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
        <div className={lead.ceo ? "text-[13px]" : "text-[13px] text-muted-foreground"}>
          {lead.ceo || "No contact person"}
        </div>
        <div className="text-[11px] text-muted-foreground">{lead.email || "No email"}</div>
      </td>
      <td>
        <span
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          title={`Source: ${sourceLabel(lead.source)}`}
          aria-label={`Source: ${sourceLabel(lead.source)}`}
        >
          <LeadSourceIcon source={lead.source} />
          {sourceLabel(lead.source)}
        </span>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <FitIndicator fit={lead.fit} />
          {lead.score !== null && (
            <span className="text-[10px] text-muted-foreground">{lead.score}/100</span>
          )}
          {lead.fitReason && (
            <span className="text-[10px] text-muted-foreground max-w-40 truncate" title={lead.fitReason}>
              {lead.fitReason}
            </span>
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
          {lead.pipelineStage === "enriching"
            ? "researching…"
            : lead.pipelineStage === "enrichment_failed"
              ? "enrichment failed"
              : lead.pipelineStage}
        </span>
        {lead.isValid === false && lead.validationErrors.length > 0 && (
          <p className="mt-1 max-w-44 truncate text-[10px] text-red-400" title={lead.validationErrors.join(". ")}>
            {lead.validationErrors[0]}
          </p>
        )}
      </td>
      <td>
        <LeadActionsMenu lead={lead} onChange={onChange} orgId={orgId} />
      </td>
    </tr>
  );
}
