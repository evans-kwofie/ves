import * as React from "react";
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
      <SidebarNav workspaceId={workspaceId} />
      <SidebarFooter workspaceId={workspaceId} />
    </aside>
  );
}
