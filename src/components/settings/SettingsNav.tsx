import * as React from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";

interface SettingsTab {
  to: string;
  label: string;
  danger?: boolean;
}

const TABS: SettingsTab[] = [
  { to: "/$workspaceId/settings/profile",   label: "Profile" },
  { to: "/$workspaceId/settings/workspace", label: "Workspace" },
  { to: "/$workspaceId/settings/billing",   label: "Billing" },
  { to: "/$workspaceId/settings/danger",    label: "Danger zone", danger: true },
];

interface SettingsNavProps {
  workspaceId: string;
}

export function SettingsNav({ workspaceId }: SettingsNavProps) {
  const matchRoute = useMatchRoute();

  return (
    <div className="relative flex items-end gap-0">
      {/* Track line — full width edge to edge */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border)]" />

      {/* Left offset to align with page content */}
      <div className="w-8 shrink-0" />

      {TABS.map((tab) => {
        const active = !!matchRoute({ to: tab.to, params: { workspaceId }, fuzzy: false });

        const textColor = active
          ? tab.danger ? "var(--destructive)" : "var(--foreground)"
          : tab.danger ? "var(--muted-foreground)" : "var(--muted-foreground)";

        const indicatorColor = tab.danger ? "var(--destructive)" : "var(--accent)";

        return (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ workspaceId }}
            style={{ textDecoration: "none", color: textColor }}
            className="relative px-4 pt-2 pb-3 text-[13px] font-medium transition-colors whitespace-nowrap"
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = tab.danger
                  ? "var(--destructive)"
                  : "var(--foreground)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
              }
            }}
          >
            {tab.label}
            {/* Active indicator — sits on top of the track line */}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: indicatorColor }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
