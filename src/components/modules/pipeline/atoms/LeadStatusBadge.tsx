import * as React from "react";
import { Badge } from "~/components/ui/badge";
import type { LeadStatus } from "~/types/lead";

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; variant: "green" | "yellow" | "red" | "blue" | "purple" | "default" }
> = {
  not_contacted: { label: "Not Contacted", variant: "default" },
  email_sent: { label: "Emailed", variant: "blue" },
  linkedin_sent: { label: "LinkedIn DM", variant: "purple" },
  replied: { label: "Replied", variant: "yellow" },
  call_scheduled: { label: "Call Scheduled", variant: "yellow" },
  converted: { label: "Converted", variant: "green" },
  not_interested: { label: "Not Interested", variant: "red" },
};

interface LeadStatusBadgeProps {
  status: LeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
