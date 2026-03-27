import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspaceId/settings/")({
  loader: ({ params }) => {
    throw redirect({
      to: "/$workspaceId/settings/profile",
      params: { workspaceId: params.workspaceId },
    });
  },
});
