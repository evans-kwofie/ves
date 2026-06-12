import * as React from "react";
import { Button } from "~/components/ui/button";
import { Loading03Icon, Linkedin01Icon, Mail01Icon, SparklesIcon, PencilEdit01Icon } from "hugeicons-react";
import { toast } from "sonner";
import { useComposeDraft } from "~/store/compose-draft";
import { DraftCard } from "./molecules/DraftCard";
import type { CampaignDraft } from "~/db/queries/drafts";
import type { CampaignStep } from "~/db/queries/steps";
import type { Lead } from "~/types/lead";
import type { EmailSignature } from "~/types/signature";

export function ReviewQueue({
  drafts,
  leads,
  steps,
  campaignId,
  signatures,
  onUpdate,
}: {
  drafts: CampaignDraft[];
  leads: Lead[];
  steps: CampaignStep[];
  campaignId: string;
  signatures: EmailSignature[];
  onUpdate: (d: CampaignDraft) => void;
}) {
  const [generating, setGenerating] = React.useState(false);
  const [generatingCell, setGeneratingCell] = React.useState<string | null>(null);
  const openCompose = useComposeDraft((s) => s.open);

  const draftMatrix = React.useMemo(() => {
    const m = new Map<string, Map<number, CampaignDraft>>();
    for (const d of drafts) {
      if (!m.has(d.leadId)) m.set(d.leadId, new Map());
      if (d.stepNumber != null) m.get(d.leadId)!.set(d.stepNumber, d);
    }
    return m;
  }, [drafts]);

  async function handleAiGen(leadId?: string, stepNumber?: number) {
    const cellKey = leadId && stepNumber != null ? `${leadId}-${stepNumber}` : null;
    if (cellKey) setGeneratingCell(cellKey); else setGenerating(true);
    try {
      const body = leadId || stepNumber != null ? { leadId, stepNumber } : undefined;
      const res = await fetch(`/api/campaigns/${campaignId}/generate-drafts`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { generated?: number; total?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      if (!cellKey) toast.success(`Generated ${data.generated} of ${data.total} drafts`);
      const fresh = (await fetch(`/api/campaigns/${campaignId}/drafts`).then((r) => r.json())) as CampaignDraft[];
      fresh.forEach(onUpdate);
    } catch {
      toast.error("Network error");
    } finally {
      if (cellKey) setGeneratingCell(null); else setGenerating(false);
    }
  }

  if (steps.length === 0) {
    return <div className="empty-state">Define your sequence steps first, then generate or draft messages here.</div>;
  }
  if (leads.length === 0) {
    return <div className="empty-state">No leads in this campaign yet.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Button onClick={() => handleAiGen()} disabled={generating}>
          {generating
            ? <><Loading03Icon size={13} className="animate-spin" />Generating...</>
            : <><SparklesIcon size={13} />AI Generate All</>}
        </Button>
        <Button variant="ghost" onClick={() => openCompose({ campaignId, leads, signatures, steps })}>
          <PencilEdit01Icon size={13} />
          Manually Draft
        </Button>
      </div>

      {leads.map((lead) => {
        const leadStepMap = draftMatrix.get(lead.id) ?? new Map<number, CampaignDraft>();

        return (
          <div key={lead.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <span className="text-[13px] font-semibold">{lead.company}</span>
              <span className="text-[12px] text-muted-foreground">{lead.ceo}</span>
              {lead.email && <span className="text-[12px] text-muted-foreground">· {lead.email}</span>}
            </div>

            {steps.map((step) => {
              const draft = leadStepMap.get(step.stepNumber);
              const channelIcon = step.channel === "linkedin" ? <Linkedin01Icon size={12} /> : <Mail01Icon size={12} />;

              return (
                <div key={step.id} className="flex flex-col gap-2 pl-3 border-l-2 border-accent/20">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    <span>Step {step.stepNumber}</span>
                    <span className="flex items-center gap-1">{channelIcon}{step.channel}</span>
                    <span>{step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}</span>
                    {step.context && <span className="normal-case font-normal italic">— {step.context}</span>}
                  </div>

                  {draft ? (
                    draft.status === "pending" ? (
                      <DraftCard draft={draft} lead={lead} campaignId={campaignId} onUpdate={onUpdate} />
                    ) : (
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-1">
                        {draft.status === "sent" && <span className="badge badge-green">Sent</span>}
                        {draft.status === "skipped" && <span className="badge badge-gray">Skipped</span>}
                        {draft.subject && <span>{draft.subject}</span>}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-[12px] text-muted-foreground">No draft yet</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={generatingCell === `${lead.id}-${step.stepNumber}`}
                        onClick={() => handleAiGen(lead.id, step.stepNumber)}
                      >
                        {generatingCell === `${lead.id}-${step.stepNumber}`
                          ? <Loading03Icon size={12} className="animate-spin" />
                          : <SparklesIcon size={12} />}
                        AI Draft
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openCompose({ campaignId, leads, signatures, steps, leadId: lead.id, stepNumber: step.stepNumber })}
                      >
                        <PencilEdit01Icon size={12} />
                        Write
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
