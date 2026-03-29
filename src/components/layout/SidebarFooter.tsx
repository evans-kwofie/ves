import * as React from "react";
import { BookOpen02Icon, HelpCircleIcon } from "hugeicons-react";

export function SidebarFooter() {
  return (
    <div className="px-2 pb-3 pt-1 flex flex-col gap-px">
      <a
        href="https://docs.vesper.app"
        target="_blank"
        rel="noopener noreferrer"
        className="nav-link"
      >
        <BookOpen02Icon size={14} primaryColor="currentColor" secondaryColor="var(--accent)" />
        Docs
      </a>
      <a
        href="mailto:support@vesper.app"
        className="nav-link"
      >
        <HelpCircleIcon size={14} primaryColor="currentColor" secondaryColor="var(--accent)" />
        Help
      </a>
    </div>
  );
}
