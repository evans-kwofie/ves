import * as React from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsNav } from "~/components/templates/SettingsNav";
import { BackButton } from "~/components/ui/back-button";

export const Route = createFileRoute("/$workspaceId/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { workspaceId } = Route.useParams();

  return (
    <div className="flex flex-col">
      <div className="h-17 flex items-center px-8 border-b border-border shrink-0 gap-4">
        <BackButton to="/$workspaceId" params={{ workspaceId }} />
        <div className="w-px h-4 bg-border" />
        <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Settings</h1>
      </div>

      <div className="pt-5">
        <SettingsNav workspaceId={workspaceId} />
      </div>

      <div className="px-8 py-8 max-w-180 w-full">
        <Outlet />
      </div>
    </div>
  );
}
