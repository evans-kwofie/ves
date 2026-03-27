import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Tag,
  MessageSquare,
  Linkedin,
  Users,
  FileText,
  Bot,
  Settings,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/$workspaceId/", label: "Dashboard", icon: <LayoutDashboard size={14} />, exact: true },
  { to: "/$workspaceId/keywords", label: "Keywords", icon: <Tag size={14} /> },
  { to: "/$workspaceId/reddit", label: "Reddit", icon: <MessageSquare size={14} /> },
  { to: "/$workspaceId/linkedin", label: "LinkedIn", icon: <Linkedin size={14} /> },
  { to: "/$workspaceId/pipeline", label: "Pipeline", icon: <Users size={14} /> },
  { to: "/$workspaceId/blog", label: "Blog Posts", icon: <FileText size={14} /> },
  { to: "/$workspaceId/agent", label: "AI Agent", icon: <Bot size={14} /> },
  { to: "/$workspaceId/settings/profile", label: "Settings", icon: <Settings size={14} /> },
];

interface SidebarNavProps {
  workspaceId: string;
}

export function SidebarNav({ workspaceId }: SidebarNavProps) {
  return (
    <nav className="flex-1 px-2 py-2 flex flex-col gap-px overflow-y-auto">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          params={{ workspaceId }}
          className="nav-link"
          activeProps={{ className: "nav-link active" }}
          activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
