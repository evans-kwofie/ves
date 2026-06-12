import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Header } from "~/components/templates/Header";
import { auth } from "~/lib/auth";
import { SignaturesTab } from "~/components/modules/templates/SignaturesTab";
import { EmailTemplatesTab } from "~/components/modules/templates/EmailTemplatesTab";
import type { EmailSignature } from "~/types/signature";

// ─── Server ───────────────────────────────────────────────────────────────────

const getTemplatesData = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, unknown> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let signatures: EmailSignature[] = [];
  try { signatures = (metadata.emailSignatures as EmailSignature[]) ?? []; } catch {}

  return { orgId: org.id, metadata: metadata as Record<string, string>, signatures };
});

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/templates")({
  loader: () => getTemplatesData(),
  component: TemplatesPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "signatures" | "email-templates";

function TemplatesPage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = React.useState<Tab>("signatures");

  return (
    <>
      <Header
        title="Templates"
        subtitle="Reusable content blocks for your outreach."
      />
      <div className="page-content">
        {!data ? (
          <p className="text-[13px] text-muted-foreground">Workspace not found.</p>
        ) : (
          <>
            <div className="tab-list">
              {(["signatures", "email-templates"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className="tab-trigger"
                  data-state={tab === t ? "active" : "inactive"}
                  onClick={() => setTab(t)}
                >
                  {t === "signatures" ? "Signatures" : "Email templates"}
                </button>
              ))}
            </div>

            {tab === "signatures" && (
              <SignaturesTab
                orgId={data.orgId}
                metadata={data.metadata}
                initialSignatures={data.signatures}
              />
            )}

            {tab === "email-templates" && <EmailTemplatesTab />}
          </>
        )}
      </div>
    </>
  );
}
