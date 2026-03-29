import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { PipelineStats } from "~/components/pipeline/PipelineStats";
import { LeadTable } from "~/components/pipeline/LeadTable";
import { AddLeadDialog } from "~/components/pipeline/AddLeadDialog";
import { Button } from "~/components/ui/button";
import { Add01Icon, AiMagicIcon } from "hugeicons-react";
import { getPipeline } from "~/db/queries/leads";
import { toast } from "sonner";
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
  const [enriching, setEnriching] = React.useState(false);

  const toEnrichCount = leads.filter((l) => l.pipelineStage === "discovered").length;

  async function enrichAll() {
    setEnriching(true);
    try {
      const res = await fetch("/api/pipeline/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: workspaceId }),
      });
      const data = (await res.json()) as { enriched?: number; failed?: number; total?: number };
      if (data.enriched !== undefined) {
        toast.success(`${data.enriched} lead${data.enriched !== 1 ? "s" : ""} enriched & scored`);
        // Refresh leads
        const refreshed = await fetch(`/api/pipeline/leads?orgId=${workspaceId}`).catch(() => null);
        if (refreshed?.ok) {
          const updated = (await refreshed.json()) as Lead[];
          setLeads(updated);
        }
      }
    } catch {
      toast.error("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <>
      <Header
        title="Pipeline"
        subtitle="Track and manage your outreach leads."
        actions={
          <div className="flex gap-2">
            {toEnrichCount > 0 && (
              <Button variant="ghost" onClick={enrichAll} disabled={enriching}>
                <AiMagicIcon size={14} />
                {enriching ? "Enriching..." : `Enrich ${toEnrichCount} lead${toEnrichCount !== 1 ? "s" : ""}`}
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)}>
              <Add01Icon size={14} />
              Add Lead
            </Button>
          </div>
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
