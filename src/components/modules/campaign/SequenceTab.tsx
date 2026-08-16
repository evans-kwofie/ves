import * as React from "react";
import {
  InformationCircleIcon,
  ArrowDown01Icon,
} from "hugeicons-react";
import { AddStepPopover } from "./molecules/AddStepPopover";
import { EmptyState } from "~/components/ui/empty-state";
import type { CampaignStep } from "~/db/queries/steps";
import type { Template } from "~/db/queries/templates";
import { StepCard } from "./atoms/step-card";
import { CHANNEL_META } from "./utils";
import type { Channel } from "~/lib/channels";

function stepTiming(step: CampaignStep, index: number): string {
  if (index === 0)
    return step.delayDays === 0
      ? "Sent immediately when a lead enters the campaign."
      : `Sent on day ${step.delayDays}.`;
  return step.delayDays === 0
    ? "Sent immediately after the previous step."
    : `Sent on day ${step.delayDays}.`;
}

export function SequenceTab({
  campaignId,
  steps,
  templates,
  channels,
  onStepsChange,
}: {
  campaignId: string;
  steps: CampaignStep[];
  templates: Template[];
  channels: Channel[];
  onStepsChange: (steps: CampaignStep[]) => void;
}) {
  function handleUpdate(updated: CampaignStep) {
    onStepsChange(steps.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleDelete(id: string) {
    onStepsChange(
      steps
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, stepNumber: i + 1 })),
    );
  }

  return (
    <div className="flex flex-col max-w-xl">
      {steps.length === 0 && (
        <EmptyState
          icon={<InformationCircleIcon />}
          title="No steps yet"
          description="A sequence controls when and how each outreach is sent. Start with an email on Day 0, then add follow-ups spaced a few days apart."
          action={
            <AddStepPopover
              campaignId={campaignId}
              steps={steps}
              allowedChannels={channels}
              onAdd={(step) => onStepsChange([...steps, step])}
            />
          }
        />
      )}

      {steps.map((step, i) => {
        const meta =
          CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ??
          CHANNEL_META.email;
        const next = steps[i + 1];
        const waitDays = next != null ? next.delayDays - step.delayDays : null;

        return (
          <React.Fragment key={step.id}>
            <StepCard
              step={step}
              index={i}
              campaignId={campaignId}
              meta={meta}
              timing={stepTiming(step, i)}
              //@ts-ignore
              templates={templates}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />

            {waitDays != null && (
              <div className="flex items-center gap-3 py-1 pl-4.5">
                <div className="flex flex-col items-center gap-1 py-2">
                  <div className="w-px h-5 border-l-2 border-dashed border-border" />
                  <ArrowDown01Icon size={12} className="text-border shrink-0" />
                  <div className="w-px h-5 border-l-2 border-dashed border-border" />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Wait {waitDays} day{waitDays !== 1 ? "s" : ""} then send next
                  step
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {steps.length > 0 && (
        <div className="mt-3">
          <AddStepPopover
            campaignId={campaignId}
            steps={steps}
            allowedChannels={channels}
            onAdd={(step) => onStepsChange([...steps, step])}
          />
        </div>
      )}
    </div>
  );
}
