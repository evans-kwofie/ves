import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { LeadTable } from "~/components/modules/pipeline/templates/LeadTable";
import { AddLeadDialog } from "~/components/modules/pipeline/templates/AddLeadDialog";
import { ImportLeadsModal } from "~/components/modules/pipeline/templates/ImportLeadsModal";
import { Button } from "~/components/ui/button";
import { Add01Icon, Upload04Icon } from "hugeicons-react";
import { getPipeline } from "~/db/queries/leads";
import type { Lead } from "~/types/lead";

const getPipelineData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => getPipeline(orgId));

export const Route = createFileRoute("/$workspaceId/pipeline")({
  loader: ({ params }) => getPipelineData({ data: params.workspaceId }),
  component: PipelinePage,
});

function PipelinePage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [leads, setLeads] = React.useState<Lead[]>(initial.leads);
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <>
      <Header
        title="Pipeline"
        subtitle="Track and manage your outreach leads."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <Upload04Icon size={14} />
              Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Add01Icon size={14} />
              Add Lead
            </Button>
          </div>
        }
      />
      <div className="page-content">
        <LeadTable
          leads={leads}
          onChange={setLeads}
          orgId={workspaceId}
          onBulkCampaign={(ids) => navigate({
            to: "/$workspaceId/campaigns/new",
            params: { workspaceId },
            search: { leadIds: ids.join(",") },
          })}
        />
      </div>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={workspaceId}
        onSuccess={(lead) => setLeads((prev) => [lead, ...prev])}
      />
      <ImportLeadsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={workspaceId}
        onSuccess={(newLeads) => setLeads((prev) => [...newLeads, ...prev])}
      />
    </>
  );
}
