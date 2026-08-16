import { Delete02Icon } from "hugeicons-react";
import React from "react";
import { Template } from "resend";
import { toast } from "sonner";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { CHANNEL_META } from "../utils";
import { EditPopover } from "./edit-popover";
import { CampaignStep } from "~/db/queries/steps";

export function StepCard({
  step,
  index,
  campaignId,
  meta,
  timing,
  templates,
  onUpdate,
  onDelete,
}: {
  step: CampaignStep;
  index: number;
  campaignId: string;
  meta: (typeof CHANNEL_META)[keyof typeof CHANNEL_META];
  timing: string;
  templates: Template[];
  onUpdate: (s: CampaignStep) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, {
        method: "DELETE",
      });
      onDelete(step.id);
    } catch {
      toast.error("Failed to delete step");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-card-border bg-card p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              {meta.icon}
              {meta.label}
              {step.channel === "linkedin" && step.linkedinType && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {step.linkedinType === "connect" ? "Connection Req." : "DM"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <EditPopover
              step={step}
              campaignId={campaignId}
              //@ts-ignore
              templates={templates}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
            <button
              className="btn btn-ghost btn-sm text-muted-foreground hover:text-red-400"
              onClick={() => setConfirmOpen(true)}
              title="Delete step"
            >
              <Delete02Icon size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 pl-7">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {timing} {meta.description(step.context ?? null)}
          </p>
          {step.templateId &&
            (() => {
              const tpl = templates.find((t) => t.id === step.templateId);
              if (!tpl) return null;
              return (
                <div className="rounded-md bg-muted border border-border px-3 py-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Template
                  </span>
                  <span className="text-[12px] text-foreground">
                    {tpl.name}
                  </span>
                  {/* @ts-ignore */}
                  {tpl.variantBBody && (
                    <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
                      A/B
                    </span>
                  )}
                </div>
              );
            })()}
          {step.context && (
            <div className="rounded-md bg-muted border border-border px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                AI context hint
              </p>
              <p className="text-[12px] text-foreground leading-relaxed">
                {step.context}
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this step?"
        description="This step and any drafts generated for it will be permanently removed."
        confirmLabel="Remove step"
        loading={deleting}
        onConfirm={remove}
      />
    </>
  );
}
