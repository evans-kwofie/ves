import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Add01Icon } from "hugeicons-react";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav } from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";

interface SidebarProps {
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string | null;
}

export function Sidebar({ workspaceId, workspaceName, workspaceLogo }: SidebarProps) {
  return (
    <aside className="sidebar">
      <SidebarHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        workspaceLogo={workspaceLogo}
      />

      {/* New Outreach button */}
      <div className="px-2 pb-2 pt-1">
        <Link
          to="/$workspaceId/campaigns"
          params={{ workspaceId }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius)] text-[13px] font-semibold transition-all"
          style={{
            background: "var(--accent)",
            color: "var(--accent-foreground)",
            textDecoration: "none",
          }}
        >
          <Add01Icon size={14} />
          New Outreach
        </Link>
      </div>

      <SidebarNav workspaceId={workspaceId} />
      <SidebarFooter />
    </aside>
  );
}
