import { Link, useMatches, useParams } from "@tanstack/react-router";
import { ArrowRight01Icon } from "hugeicons-react";

const SEGMENT_LABELS: Record<string, string> = {
  campaigns:    "Campaigns",
  pipeline:     "Pipeline",
  reddit:       "Reddit",
  keywords:     "Keywords",
  directories:  "Directories",
  linkedin:     "LinkedIn",
  templates:    "Templates",
  blog:         "Blog",
  settings:     "Settings",
  profile:      "Profile",
  workspace:    "Workspace",
  appearance:   "Appearance",
  agent:        "Agent voice",
  email:        "Email / SMTP",
  billing:      "Billing",
  danger:       "Danger zone",
  new:          "New",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Crumb {
  label: string;
  path: string;
}

export function Breadcrumbs() {
  const { workspaceId } = useParams({ strict: false }) as { workspaceId?: string };
  const matches = useMatches();

  if (!workspaceId) return null;

  // Get the most specific match's pathname and strip the workspaceId prefix
  const fullPath = matches[matches.length - 1]?.pathname ?? "";
  const relative = fullPath.replace(`/${workspaceId}`, "").replace(/^\//, "");
  const segments = relative.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-[12px] font-medium text-foreground">Dashboard</span>;
  }

  const crumbs: Crumb[] = [];
  let built = `/${workspaceId}`;

  for (const seg of segments) {
    built += `/${seg}`;
    const label = UUID_RE.test(seg) ? "Details" : (SEGMENT_LABELS[seg] ?? null);
    if (label) crumbs.push({ label, path: built });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        to="/$workspaceId"
        params={{ workspaceId }}
        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        style={{ textDecoration: "none" }}
      >
        Dashboard
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <ArrowRight01Icon size={10} className="text-muted-foreground/50 shrink-0" />
            {isLast ? (
              <span className="text-[12px] font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                style={{ textDecoration: "none" }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
