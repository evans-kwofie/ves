import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { Button } from "~/components/ui/button";
import { ArrowLeft01Icon, Linkedin01Icon, Mail01Icon } from "hugeicons-react";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listDrafts } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import type { CampaignStep } from "~/db/queries/steps";
import { auth } from "~/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { ComposeDraftPanel } from "~/components/modules/campaign/ComposeDraftPanel";
import { SequenceTab } from "~/components/modules/campaign/SequenceTab";
import { ReviewQueue } from "~/components/modules/campaign/ReviewQueue";
import { LeadsTab } from "~/components/modules/campaign/LeadsTab";
import { ResultsTab } from "~/components/modules/campaign/ResultsTab";
import type { EmailSignature } from "~/types/signature";
import type { Campaign } from "~/types/campaign";
import type { Lead } from "~/types/lead";
import type { CampaignDraft } from "~/db/queries/drafts";

// ─── Server ──────────────────────────────────────────────────────────────────

const getCampaignDetail = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: id }) => {
    const headers = getRequestHeaders();
    const [campaign, leads, drafts, steps, orgs] = await Promise.all([
      getCampaign(id),
      getCampaignLeadsWithData(id),
      listDrafts(id),
      listSteps(id),
      auth.api.listOrganizations({ headers }).catch(() => []),
    ]);
    if (!campaign) return null;
    let signatures: EmailSignature[] = [];
    try {
      const org = orgs?.[0];
      const meta = org?.metadata ? JSON.parse(org.metadata as string) : {};
      signatures = (meta.emailSignatures as EmailSignature[]) ?? [];
    } catch {}
    return { campaign, leads, drafts, steps, signatures };
  });

export const Route = createFileRoute("/$workspaceId/campaigns/$id/")({
  loader: ({ params }) => getCampaignDetail({ data: params.id }),
  component: CampaignDetailPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "sequence" | "queue" | "leads" | "results";

function CampaignDetailPage() {
  const initial = Route.useLoaderData();
  const { workspaceId, id } = Route.useParams();

  const [campaign] = React.useState<Campaign | null>(initial?.campaign ?? null);
  const [leads] = React.useState<Lead[]>(initial?.leads ?? []);
  const [drafts, setDrafts] = React.useState<CampaignDraft[]>(
    initial?.drafts ?? [],
  );
  const [steps, setSteps] = React.useState<CampaignStep[]>(
    initial?.steps ?? [],
  );
  const [tab, setTab] = React.useState<Tab>("sequence");

  if (!campaign) {
    return (
      <div className="page-content">
        <p className="text-[13px] text-muted-foreground">Campaign not found.</p>
      </div>
    );
  }

  const pending = drafts.filter((d) => d.status === "pending");
  const sent = drafts.filter((d) => d.status === "sent");
  const skipped = drafts.filter((d) => d.status === "skipped");

  function handleDraftUpdate(updated: CampaignDraft) {
    setDrafts((prev) => {
      const exists = prev.some((d) => d.id === updated.id);
      return exists
        ? prev.map((d) => (d.id === updated.id ? updated : d))
        : [...prev, updated];
    });
  }

  function handleDraftAdded(draft: CampaignDraft) {
    setDrafts((prev) => [...prev, draft]);
    setTab("queue");
  }

  const statusBadge =
    (
      {
        draft: "badge badge-gray",
        active: "badge badge-green",
        scheduled: "badge badge-blue",
        completed: "badge badge-purple",
      } as Record<string, string>
    )[campaign.status] ?? "badge badge-gray";

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "sequence", label: "Sequence", count: steps.length },
    { value: "queue", label: "Review Queue", count: pending.length },
    { value: "leads", label: "Leads", count: leads.length },
    { value: "results", label: "Results", count: sent.length },
  ];

  return (
    <>
      <Header
        title={campaign.name}
        subtitle={campaign.goal ?? "Outreach campaign"}
        actions={
          <Link to="/$workspaceId/campaigns" params={{ workspaceId }}>
            <Button variant="ghost">
              <ArrowLeft01Icon size={14} />
              Campaigns
            </Button>
          </Link>
        }
      />

      <div className="page-content">
        <div className="tab-list">
          {tabs.map((t) => (
            <button
              key={t.value}
              className="tab-trigger"
              data-state={tab === t.value ? "active" : "inactive"}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1 py-px">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "sequence" && (
          <SequenceTab campaignId={id} steps={steps} onStepsChange={setSteps} />
        )}
        {tab === "queue" && (
          <ReviewQueue
            drafts={drafts}
            leads={leads}
            steps={steps}
            campaignId={id}
            signatures={initial?.signatures ?? []}
            onUpdate={handleDraftUpdate}
          />
        )}
        {tab === "leads" && <LeadsTab leads={leads} drafts={drafts} />}
        {tab === "results" && (
          <ResultsTab
            sent={sent}
            skipped={skipped}
            leads={leads}
            steps={steps}
          />
        )}
      </div>

      <ComposeDraftPanel onDraftAdded={handleDraftAdded} />
    </>
  );
}
