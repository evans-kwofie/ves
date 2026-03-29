import * as React from "react";
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { ArrowLeft01Icon } from "hugeicons-react";
import { SettingsNav } from "~/components/settings/SettingsNav";

export const Route = createFileRoute("/$workspaceId/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { workspaceId } = Route.useParams();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="h-[68px] flex items-center px-8 border-b border-[var(--border)] shrink-0 gap-4">
        <Link
          to="/$workspaceId/"
          params={{ workspaceId }}
          className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          style={{ textDecoration: "none" }}
        >
          <ArrowLeft01Icon size={13} />
          Back
        </Link>
        <div className="w-px h-4 bg-[var(--border)]" />
        <h1 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="pt-5">
        <SettingsNav workspaceId={workspaceId} />
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 max-w-[720px] w-full">
        <Outlet />
      </div>
    </div>
  );
}
