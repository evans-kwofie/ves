import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod";
import { Sidebar } from "~/components/layout/Sidebar";
import { Shell } from "~/components/layout/Shell";
import { auth } from "~/lib/auth";
import { getSessionFn } from "~/lib/session";

const getWorkspace = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: workspaceId }) => {
    const session = await getSessionFn();
    if (!session) return null;
    const headers = getRequestHeaders();
    try {
      const org = await auth.api.getFullOrganization({
        headers,
        query: { organizationId: workspaceId },
      });
      return org;
    } catch {
      return null;
    }
  });

export const Route = createFileRoute("/$workspaceId")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/sign-in" });
  },
  loader: async ({ params }) => {
    const workspace = await getWorkspace({ data: params.workspaceId });
    if (!workspace) throw redirect({ to: "/sign-in" });
    return { workspace };
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { workspaceId } = Route.useParams();
  const { workspace } = Route.useLoaderData();

  return (
    <div className="app-layout">
      <Sidebar
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        workspaceLogo={workspace.logo}
      />
      <Shell>
        <Outlet />
      </Shell>
    </div>
  );
}
