import * as React from "react";
import { Mail01Icon, Linkedin01Icon, Delete02Icon, InformationCircleIcon } from "hugeicons-react";
import { toast } from "sonner";
import { StepPopover } from "./molecules/StepPopover";
import { AddStepPopover } from "./molecules/AddStepPopover";
import type { CampaignStep } from "~/db/queries/steps";

const CHANNEL_META = {
  email: { label: "Email", icon: <Mail01Icon size={14} /> },
  linkedin: { label: "LinkedIn", icon: <Linkedin01Icon size={14} /> },
} as const;

export function SequenceTab({
  campaignId,
  steps,
  onStepsChange,
}: {
  campaignId: string;
  steps: CampaignStep[];
  onStepsChange: (steps: CampaignStep[]) => void;
}) {
  function handleUpdate(updated: CampaignStep) {
    onStepsChange(steps.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleDelete(id: string) {
    onStepsChange(steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  }

  return (
    <div className="flex flex-col max-w-[560px]">
      {steps.length === 0 && (
        <div className="flex flex-col items-center gap-2 pt-9 pb-6 text-center">
          <InformationCircleIcon size={26} className="text-muted-foreground opacity-35" />
          <p className="text-[13px] font-semibold">No steps yet</p>
          <p className="text-[12px] text-muted-foreground max-w-sm leading-relaxed mb-5">
            A sequence controls when and how each outreach is sent. Start with an email on Day 0, then add follow-ups spaced a few days apart.
          </p>
        </div>
      )}

      {steps.map((step, i) => {
        const meta = CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.email;
        const next = steps[i + 1];
        const waitDays = next != null ? next.delayDays - step.delayDays : null;

        return (
          <React.Fragment key={step.id}>
            {/* Step row */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 shrink-0 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-[11px] font-bold">
                {i + 1}
              </div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold shrink-0">
                  {meta.icon}
                  {meta.label}
                </div>
                <span className="text-[12px] text-muted-foreground shrink-0">
                  {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                </span>
                {step.context && (
                  <span className="text-[11px] text-muted-foreground italic truncate flex-1">
                    "{step.context}"
                  </span>
                )}
                <div className="flex items-center gap-0.5 ml-auto shrink-0">
                  <StepPopover step={step} campaignId={campaignId} onUpdate={handleUpdate} onDelete={handleDelete} />
                  <button
                    className="btn btn-ghost btn-sm text-muted-foreground"
                    title="Delete step"
                    onClick={async () => {
                      try {
                        await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
                        handleDelete(step.id);
                      } catch {
                        toast.error("Failed to delete step");
                      }
                    }}
                  >
                    <Delete02Icon size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dashed connector + wait label */}
            <div className="flex gap-2.5">
              <div className="w-7 shrink-0 flex justify-center">
                <div className={`border-l border-dashed border-border ${waitDays != null ? "h-10" : "h-5"}`} />
              </div>
              {waitDays != null && (
                <div className="flex items-center text-[11px] text-muted-foreground italic">
                  Wait {waitDays} day{waitDays !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      <AddStepPopover campaignId={campaignId} steps={steps} onAdd={(step) => onStepsChange([...steps, step])} />
    </div>
  );
}
