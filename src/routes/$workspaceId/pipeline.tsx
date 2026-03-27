import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { PipelineStats } from "~/components/pipeline/PipelineStats";
import { LeadTable } from "~/components/pipeline/LeadTable";
import { AddLeadDialog } from "~/components/pipeline/AddLeadDialog";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { getPipeline } from "~/db/queries/leads";
import type { Lead, PipelineMeta } from "~/types/lead";

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
  const [leads, setLeads] = React.useState<Lead[]>(initial.leads);
  const [meta] = React.useState<PipelineMeta>(initial.meta);
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <>
      <Header
        title="Pipeline"
        subtitle="Track and manage your outreach leads."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={14} />
            Add Lead
          </Button>
        }
      />
      <div className="page-content">
        <PipelineStats leads={leads} meta={meta} />
        <LeadTable leads={leads} onChange={setLeads} />
      </div>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={workspaceId}
        onSuccess={(lead) => setLeads((prev) => [lead, ...prev])}
      />
    </>
  );
}
