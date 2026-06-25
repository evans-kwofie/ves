import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { Button } from "~/components/ui/button";
import { Add01Icon } from "hugeicons-react";
import { listCampaigns } from "~/db/queries/campaigns";
import { CampaignRow } from "~/components/modules/campaign/CampaignRow";
import type { Campaign, CampaignStatus } from "~/types/campaign";

const getCampaignsData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listCampaigns(orgId));

export const Route = createFileRoute("/$workspaceId/campaigns/")({
  loader: ({ params }) => getCampaignsData({ data: params.workspaceId }),
  component: CampaignsPage,
});

const STATUS_TABS: { label: string; value: CampaignStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Drafts", value: "draft" },
  { label: "Completed", value: "completed" },
];

function CampaignsPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [campaigns, setCampaigns] = React.useState<Campaign[]>(initial);
  const [tab, setTab] = React.useState<CampaignStatus | "all">("all");

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  function handleDelete(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function handleStatusChange(id: string, status: CampaignStatus) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  return (
    <>
      <Header
        title="Campaigns"
        subtitle="Manage outreach sequences and track their performance."
        actions={
          <Link to="/$workspaceId/campaigns/new" params={{ workspaceId }}>
            <Button>
              <Add01Icon size={14} />
              New Campaign
            </Button>
          </Link>
        }
      />
      <div className="page-content">
        <div className="tab-list mb-4">
          {STATUS_TABS.map((t) => {
            const count = t.value === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.value).length;
            return (
              <button
                key={t.value}
                className="tab-trigger"
                data-state={tab === t.value ? "active" : "inactive"}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1 py-px">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="mb-4">
              {tab === "all"
                ? "No campaigns yet. Create your first campaign to start tracking outreach sequences."
                : `No ${tab} campaigns.`}
            </div>
            {tab === "all" && (
              <Link to="/$workspaceId/campaigns/new" params={{ workspaceId }}>
                <Button size="sm">
                  <Add01Icon size={13} />
                  New Campaign
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Campaign", "Status", "Channel", "Leads", "Sent", "Replies", "Reply Rate", ""].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider last:w-10"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    workspaceId={workspaceId}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
