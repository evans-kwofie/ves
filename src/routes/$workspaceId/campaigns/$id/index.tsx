import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { getCampaign, getCampaignLeadsWithData } from "~/db/queries/campaigns";
import { listDrafts } from "~/db/queries/drafts";
import { listSteps } from "~/db/queries/steps";
import type { CampaignStep } from "~/db/queries/steps";
import { listTemplates } from "~/db/queries/templates";
import type { Template } from "~/db/queries/templates";
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
import CampaignDetailheader from "~/components/modules/campaign/molecules/CampaignDetailsHeader";

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
    const org = orgs?.[0];
    try {
      const meta = org?.metadata ? JSON.parse(org.metadata as string) : {};
      signatures = (meta.emailSignatures as EmailSignature[]) ?? [];
    } catch {}
    const templates = org ? await listTemplates(org.id) : [];
    return { campaign, leads, drafts, steps, signatures, templates };
  });

export const Route = createFileRoute("/$workspaceId/campaigns/$id/")({
  loader: ({ params }) => getCampaignDetail({ data: params.id }),
  component: CampaignDetailPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "sequence" | "queue" | "leads" | "results";

function CampaignDetailPage() {
  const initial = Route.useLoaderData();
  console.log("initial", initial);
  const { workspaceId, id } = Route.useParams();

  const [campaign, setCampaign] = React.useState<Campaign | null>(
    initial?.campaign ?? null,
  );
  // @ts-ignore
  const [leads, setLeads] = React.useState<Lead[]>(initial?.leads ?? []);
  const [drafts, setDrafts] = React.useState<CampaignDraft[]>(
    initial?.drafts ?? [],
  );
  const [steps, setSteps] = React.useState<CampaignStep[]>(
    initial?.steps ?? [],
  );
  const [templates] = React.useState<Template[]>(initial?.templates ?? []);
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

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "sequence", label: "Sequence", count: steps.length },
    { value: "queue", label: "Review Queue", count: drafts.length },
    { value: "leads", label: "Contacts", count: leads.length },
    { value: "results", label: "Results", count: sent.length },
  ];

  return (
    <>
      <CampaignDetailheader campaign={campaign} workspaceId={workspaceId} />

      {/* <Header
        title={campaign.name}
        subtitle={campaign.goal ?? "Outreach campaign"}
        actions={
          campaign && (
            <CampaignDetailDropdown
              workspaceId={workspaceId}
              campaignId={id as string}
              status={campaign.status}
              stepCount={steps.length}
              existingLeadIds={leads.map((l) => l.id)}
              onDelete={() => window.history.back()}
              onStatusChange={(_, status) =>
                setCampaign((c) => (c ? { ...c, status } : c))
              }
              onLeadAdded={(lead) =>
                setLeads((prev) =>
                  prev.some((l) => l.id === lead.id) ? prev : [...prev, lead],
                )
              }
            />
          )
        }
      /> */}

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

        <div key={tab} className="tab-reveal">
          {tab === "sequence" && (
            <SequenceTab
              campaignId={id}
              steps={steps}
              templates={templates}
              channels={campaign.channels}
              onStepsChange={setSteps}
            />
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
      </div>

      <ComposeDraftPanel onDraftAdded={handleDraftAdded} />
    </>
  );
}
