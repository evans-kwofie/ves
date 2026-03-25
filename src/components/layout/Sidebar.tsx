import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Tag,
  MessageSquare,
  Linkedin,
  Users,
  FileText,
  Bot,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
  { to: "/keywords", label: "Keywords", icon: <Tag size={15} /> },
  { to: "/reddit", label: "Reddit", icon: <MessageSquare size={15} /> },
  { to: "/linkedin", label: "LinkedIn", icon: <Linkedin size={15} /> },
  { to: "/pipeline", label: "Pipeline", icon: <Users size={15} /> },
  { to: "/blog", label: "Blog Posts", icon: <FileText size={15} /> },
  { to: "/agent", label: "AI Agent", icon: <Bot size={15} /> },
  { to: "/setttings/profile", label: "Profile", icon: <Users size={15} /> },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          vesper<span className="sidebar-logo-dot">.</span>
        </div>
        <div className="sidebar-logo-sub">Marketing Toolkit</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigate</div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.to === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link${isActive ? " active" : ""}`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
      </div>
    </aside>
  );
}
