import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Header } from "~/components/templates/Header";
import { auth } from "~/lib/auth";
import { listTemplates } from "~/db/queries/templates";
import { SignaturesTab } from "~/components/modules/templates/SignaturesTab";
import { EmailTemplatesTab } from "~/components/modules/templates/EmailTemplatesTab";
import type { EmailSignature } from "~/types/signature";
import type { Template } from "~/db/queries/templates";

const getTemplatesData = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, unknown> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let signatures: EmailSignature[] = [];
  try { signatures = (metadata.emailSignatures as EmailSignature[]) ?? []; } catch {}

  const templates = await listTemplates(org.id);

  return {
    orgId: org.id,
    orgName: org.name,
    orgLogo: org.logo ?? null,
    metadata: metadata as Record<string, string>,
    signatures,
    templates,
  };
});

export const Route = createFileRoute("/$workspaceId/templates/")({
  loader: () => getTemplatesData(),
  component: TemplatesPage,
});

type Tab = "templates" | "signatures";

function TemplatesPage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = React.useState<Tab>("templates");
  const [templates, setTemplates] = React.useState<Template[]>(data?.templates ?? []);

  const signerName = data?.signatures?.[0]?.name ?? data?.orgName;

  return (
    <>
      <Header
        title="Templates"
        subtitle="Reusable message structures for your outreach."
      />
      <div className="page-content">
        {!data ? (
          <p className="text-[13px] text-muted-foreground">Workspace not found.</p>
        ) : (
          <>
            <div className="tab-list">
              {(["templates", "signatures"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className="tab-trigger"
                  data-state={tab === t ? "active" : "inactive"}
                  onClick={() => setTab(t)}
                >
                  {t === "templates" ? "Templates" : "Signatures"}
                </button>
              ))}
            </div>

            {tab === "templates" && (
              <EmailTemplatesTab
                orgId={data.orgId}
                orgName={data.orgName}
                orgLogo={data.orgLogo}
                signerName={signerName}
                initialTemplates={templates}
              />
            )}

            {tab === "signatures" && (
              <SignaturesTab
                orgId={data.orgId}
                metadata={data.metadata}
                initialSignatures={data.signatures}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
