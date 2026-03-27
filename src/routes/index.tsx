import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "~/lib/auth";
import { getSessionFn } from "~/lib/session";

const getFirstWorkspaceId = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  return orgs?.[0]?.id ?? null;
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const workspaceId = await getFirstWorkspaceId();
    if (!workspaceId) {
      const session = await getSessionFn();
      throw redirect({ to: session ? "/onboarding" : "/sign-in" });
    }
    throw redirect({ to: "/$workspaceId", params: { workspaceId } });
  },
});
