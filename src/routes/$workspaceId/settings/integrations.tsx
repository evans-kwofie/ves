import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { Linkedin01Icon, LinkSquare01Icon } from "hugeicons-react";
import { toast } from "sonner";

const getIntegrations = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: workspaceId }) => {
    const headers = getRequestHeaders();
    const orgs = await auth.api.listOrganizations({ headers });
    const org = orgs?.find((o) => o.id === workspaceId || o.slug === workspaceId);
    if (!org) return null;
    let meta: Record<string, string> = {};
    try { meta = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}
    return {
      orgId: org.id,
      metadata: meta,
      linkedinConnected: !!meta.linkedinAccessToken,
      linkedinDisplayName: meta.linkedinDisplayName ?? "",
      linkedinTokenExpiry: meta.linkedinTokenExpiry ? Number(meta.linkedinTokenExpiry) : null,
    };
  });

export const Route = createFileRoute("/$workspaceId/settings/integrations")({
  loader: ({ params }) => getIntegrations({ data: params.workspaceId }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const data = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [search] = React.useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  );

  React.useEffect(() => {
    if (search.get("linkedin_connected") === "1") {
      toast.success("LinkedIn connected successfully");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (search.get("linkedin_error")) {
      toast.error("LinkedIn connection failed — please try again");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!data) return <p className="text-[13px] text-muted-foreground">Workspace not found.</p>;

  const tokenExpired = data.linkedinTokenExpiry ? Date.now() > data.linkedinTokenExpiry : false;
  const isConnected = data.linkedinConnected && !tokenExpired;

  async function disconnect() {
    await authClient.organization.update({
      organizationId: data!.orgId,
      data: {
        metadata: {
          ...data!.metadata,
          linkedinAccessToken: "",
          linkedinMemberId: "",
          linkedinDisplayName: "",
          linkedinTokenExpiry: "",
        },
      },
    });
    toast.success("LinkedIn disconnected");
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">Integrations</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Connect external accounts to publish content directly.</p>
      </div>

      {/* LinkedIn */}
      <div className="card p-5 flex items-center gap-4">
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#0A66C2", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Linkedin01Icon size={20} color="#fff" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">LinkedIn</p>
          {isConnected ? (
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Connected as <span className="text-foreground font-medium">{data.linkedinDisplayName || "your account"}</span>
            </p>
          ) : tokenExpired && data.linkedinConnected ? (
            <p className="text-[12px] text-destructive mt-0.5">Token expired — reconnect to keep posting</p>
          ) : (
            <p className="text-[12px] text-muted-foreground mt-0.5">Post directly to LinkedIn from your content page</p>
          )}
        </div>

        {isConnected ? (
          <Button variant="ghost" size="sm" onClick={disconnect} className="shrink-0">
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => { window.location.href = `/api/linkedin/authorize?workspaceId=${workspaceId}`; }}
          >
            <LinkSquare01Icon size={13} /> Connect
          </Button>
        )}
      </div>
    </div>
  );
}
