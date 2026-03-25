import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Header } from "~/components/layout/Header";
import { PipelineStats } from "~/components/pipeline/PipelineStats";
import { LeadTable } from "~/components/pipeline/LeadTable";
import { AddLeadDialog } from "~/components/pipeline/AddLeadDialog";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { initDb } from "~/db/schema";
import { getPipeline } from "~/db/queries/leads";
import type { Lead, PipelineMeta } from "~/types/lead";

const getPipelineData = createServerFn().handler(async () => {
  await initDb();
  return getPipeline();
});

export const Route = createFileRoute("/pipeline")({
  loader: () => getPipelineData(),
  component: PipelinePage,
});

function PipelinePage() {
  const initial = Route.useLoaderData();
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
        onSuccess={(lead) => setLeads((prev) => [lead, ...prev])}
      />
    </>
  );
}
