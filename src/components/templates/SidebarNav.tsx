import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  DashboardBrowsingIcon,
  Target01Icon,
  User02Icon,
  Tag01Icon,
  MessageSearch01Icon,
  CompassIcon,
  Linkedin01Icon,
  Setting07Icon,
  FileEditIcon,
  BarChartIcon,
  PencilEdit01Icon,
} from "hugeicons-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/$workspaceId/", label: "Dashboard", icon: <DashboardBrowsingIcon size={14} />, exact: true },
    ],
  },
  {
    label: "Outreach",
    items: [
      { to: "/$workspaceId/campaigns", label: "Campaigns", icon: <Target01Icon size={14} /> },
      { to: "/$workspaceId/pipeline", label: "Pipeline", icon: <User02Icon size={14} /> },
      { to: "/$workspaceId/templates", label: "Templates", icon: <FileEditIcon size={14} /> },
      { to: "/$workspaceId/analytics", label: "Analytics", icon: <BarChartIcon size={14} /> },
    ],
  },
  {
    label: "Signals",
    items: [
      { to: "/$workspaceId/keywords", label: "Keywords", icon: <Tag01Icon size={14} /> },
      { to: "/$workspaceId/reddit", label: "Reddit", icon: <MessageSearch01Icon size={14} /> },
    ],
  },
  {
    label: "Lead Gen",
    items: [
      { to: "/$workspaceId/directories", label: "Directories", icon: <CompassIcon size={14} /> },
      { to: "/$workspaceId/linkedin", label: "LinkedIn", icon: <Linkedin01Icon size={14} /> },
      { to: "/$workspaceId/blog", label: "Content", icon: <PencilEdit01Icon size={14} /> },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { to: "/$workspaceId/settings/profile", label: "Settings", icon: <Setting07Icon size={14} /> },
];

interface SidebarNavProps {
  workspaceId: string;
}

function NavLink({ item, workspaceId }: { item: NavItem; workspaceId: string }) {
  return (
    <Link
      to={item.to}
      params={{ workspaceId }}
      className="nav-link"
      activeProps={{ className: "nav-link active" }}
      activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export function SidebarNav({ workspaceId }: SidebarNavProps) {
  return (
    <nav className="flex-1 px-2 py-2 flex flex-col gap-px overflow-y-auto">
      {NAV_SECTIONS.map((section, i) => (
        <div key={i} className={section.label ? "mt-2" : undefined}>
          {section.label && (
            <div className="sidebar-section-label">{section.label}</div>
          )}
          {section.items.map((item) => (
            <NavLink key={item.to} item={item} workspaceId={workspaceId} />
          ))}
        </div>
      ))}
      <div className="mt-auto pt-2 flex flex-col gap-px">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.to} item={item} workspaceId={workspaceId} />
        ))}
      </div>
    </nav>
  );
}
