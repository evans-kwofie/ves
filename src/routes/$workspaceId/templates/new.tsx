import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "~/lib/auth";
import { TemplateEditorPage } from "~/components/modules/templates/TemplateEditorPage";
import type { EmailSignature } from "~/types/signature";

const getNewTemplateData = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, unknown> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let signatures: EmailSignature[] = [];
  try { signatures = (metadata.emailSignatures as EmailSignature[]) ?? []; } catch {}

  return {
    orgId: org.id,
    orgName: org.name,
    orgLogo: org.logo ?? null,
    signatures,
  };
});

export const Route = createFileRoute("/$workspaceId/templates/new")({
  loader: () => getNewTemplateData(),
  component: NewTemplatePage,
});

function NewTemplatePage() {
  const data = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();

  if (!data) return <p className="p-6 text-[13px] text-muted-foreground">Workspace not found.</p>;

  const signerName = data.signatures[0]?.name ?? data.orgName;

  return (
    <TemplateEditorPage
      orgId={data.orgId}
      orgName={data.orgName}
      orgLogo={data.orgLogo}
      signerName={signerName}
      onBack={() => navigate({ to: "/$workspaceId/templates/", params: { workspaceId } })}
    />
  );
}
