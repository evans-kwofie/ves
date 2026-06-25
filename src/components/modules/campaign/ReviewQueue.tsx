import * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Loading03Icon,
  Linkedin01Icon,
  InstagramIcon,
  Mail01Icon,
  SparklesIcon,
  PencilEdit01Icon,
  CheckmarkCircle01Icon,
  MinusSignIcon,
} from "hugeicons-react";
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
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex gap-2 justify-end">
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

      {/* Lead cards */}
      {leads.map((lead) => {
        const leadStepMap = draftMatrix.get(lead.id) ?? new Map<number, CampaignDraft>();
        const doneCount = steps.filter((s) => {
          const d = leadStepMap.get(s.stepNumber);
          return d?.status === "sent" || d?.status === "skipped";
        }).length;

        return (
          <div key={lead.id} className="rounded-xl border border-card-border bg-card overflow-hidden">
            {/* Lead header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-card-border bg-muted/40">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-semibold text-foreground truncate">{lead.company}</span>
                <span className="text-[12px] text-muted-foreground shrink-0">{lead.ceo}</span>
                {lead.email && (
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">· {lead.email}</span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                {doneCount}/{steps.length} done
              </span>
            </div>

            {/* Steps */}
            <div className="divide-y divide-border">
              {steps.map((step) => {
                const draft = leadStepMap.get(step.stepNumber);
                const cellKey = `${lead.id}-${step.stepNumber}`;
                const isGenerating = generatingCell === cellKey;
                const channelIcon = step.channel === "linkedin"
                  ? <Linkedin01Icon size={12} />
                  : step.channel === "instagram"
                  ? <InstagramIcon size={12} />
                  : <Mail01Icon size={12} />;

                return (
                  <div key={step.id} className="flex flex-col">
                    {/* Step row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Step number */}
                      <span className="size-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">
                        {step.stepNumber}
                      </span>

                      {/* Step info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground font-medium capitalize">
                          {channelIcon}
                          {step.channel}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                        </span>
                        {step.context && (
                          <span className="text-[11px] text-muted-foreground italic truncate hidden md:block">
                            — {step.context}
                          </span>
                        )}
                      </div>

                      {/* Status / actions (right side) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {draft?.status === "sent" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-500">
                            <CheckmarkCircle01Icon size={12} />
                            Sent
                          </span>
                        )}
                        {draft?.status === "skipped" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <MinusSignIcon size={12} />
                            Skipped
                          </span>
                        )}
                        {!draft && (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={isGenerating}
                              onClick={() => handleAiGen(lead.id, step.stepNumber)}
                            >
                              {isGenerating
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
                          </>
                        )}
                      </div>
                    </div>

                    {/* Draft card — only for pending drafts */}
                    {draft?.status === "pending" && (
                      <div className="px-4 pb-4">
                        <DraftCard
                          draft={draft}
                          lead={lead}
                          campaignId={campaignId}
                          onUpdate={onUpdate}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
