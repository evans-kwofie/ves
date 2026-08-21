import * as React from "react";
import { Badge } from "~/components/ui/badge";
import type { LeadStatus } from "~/types/lead";

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  not_contacted: { label: "Not Contacted", variant: "default" },
  email_sent: { label: "Emailed", variant: "secondary", className: "text-blue-400" },
  linkedin_sent: { label: "LinkedIn DM", variant: "secondary", className: "text-purple-400" },
  instagram_sent: { label: "Instagram DM", variant: "secondary", className: "text-pink-400" },
  replied: { label: "Replied", variant: "outline", className: "border-amber-400/30 text-amber-400" },
  call_scheduled: { label: "Call Scheduled", variant: "outline", className: "border-amber-400/30 text-amber-400" },
  converted: { label: "Converted", variant: "default", className: "bg-emerald-500 text-white" },
  not_interested: { label: "Not Interested", variant: "destructive" },
};

interface LeadStatusBadgeProps {
  status: LeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
}
