import * as React from "react";
import {
  Mail01Icon,
  Linkedin01Icon,
  InstagramIcon,
  Delete02Icon,
  InformationCircleIcon,
  ArrowDown01Icon,
  Edit01Icon,
  Loading03Icon,
} from "hugeicons-react";
import { toast } from "sonner";
import { AddStepPopover } from "./molecules/AddStepPopover";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import type { CampaignStep } from "~/db/queries/steps";
import type { Template } from "~/db/queries/templates";

const CHANNEL_META = {
  email: {
    label: "Email",
    icon: <Mail01Icon size={14} />,
    description: (ctx: string | null) =>
      ctx
        ? `The AI will write a personalised email for each lead — ${ctx.toLowerCase()}`
        : "The AI will write a personalised cold email for each lead based on their profile.",
  },
  linkedin: {
    label: "LinkedIn message",
    icon: <Linkedin01Icon size={14} />,
    description: (ctx: string | null) =>
      ctx
        ? `The AI will draft a LinkedIn message for each lead — ${ctx.toLowerCase()}`
        : "The AI will draft a short LinkedIn message for each lead. You'll copy and send it manually.",
  },
  instagram: {
    label: "Instagram DM",
    icon: <InstagramIcon size={14} />,
    description: (ctx: string | null) =>
      ctx
        ? `The AI will write a casual Instagram DM for each lead — ${ctx.toLowerCase()}`
        : "The AI will write a short, punchy Instagram DM for each lead. Casual tone, under 3 sentences. You'll copy and send it manually.",
  },
} as const;

function stepTiming(step: CampaignStep, index: number): string {
  if (index === 0) return step.delayDays === 0 ? "Sent immediately when a lead enters the campaign." : `Sent on day ${step.delayDays}.`;
  return step.delayDays === 0 ? "Sent immediately after the previous step." : `Sent on day ${step.delayDays}.`;
}

export function SequenceTab({
  campaignId,
  steps,
  templates,
  onStepsChange,
}: {
  campaignId: string;
  steps: CampaignStep[];
  templates: Template[];
  onStepsChange: (steps: CampaignStep[]) => void;
}) {
  function handleUpdate(updated: CampaignStep) {
    onStepsChange(steps.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleDelete(id: string) {
    onStepsChange(steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  }

  return (
    <div className="flex flex-col max-w-xl">
      {steps.length === 0 && (
        <EmptyState
          icon={<InformationCircleIcon />}
          title="No steps yet"
          description="A sequence controls when and how each outreach is sent. Start with an email on Day 0, then add follow-ups spaced a few days apart."
        />
      )}

      {steps.map((step, i) => {
        const meta = CHANNEL_META[step.channel as keyof typeof CHANNEL_META] ?? CHANNEL_META.email;
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
                  Wait {waitDays} day{waitDays !== 1 ? "s" : ""} then send next step
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}

      <div className={steps.length > 0 ? "mt-3" : ""}>
        <AddStepPopover campaignId={campaignId} steps={steps} onAdd={(step) => onStepsChange([...steps, step])} />
      </div>
    </div>
  );
}

function StepCard({
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
      await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
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
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <EditPopover step={step} campaignId={campaignId} templates={templates} onUpdate={onUpdate} onDelete={onDelete} />
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
        {step.templateId && (() => {
          const tpl = templates.find((t) => t.id === step.templateId);
          if (!tpl) return null;
          return (
            <div className="rounded-md bg-muted border border-border px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template</span>
              <span className="text-[12px] text-foreground">{tpl.name}</span>
              {tpl.variantBBody && (
                <span className="ml-auto text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">A/B</span>
              )}
            </div>
          );
        })()}
        {step.context && (
          <div className="rounded-md bg-muted border border-border px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">AI context hint</p>
            <p className="text-[12px] text-foreground leading-relaxed">{step.context}</p>
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

function EditPopover({
  step,
  campaignId,
  templates,
  onUpdate,
  onDelete,
}: {
  step: CampaignStep;
  campaignId: string;
  templates: Template[];
  onUpdate: (s: CampaignStep) => void;
  onDelete: (id: string) => void;
}) {
  const [channel, setChannel] = React.useState<"email" | "linkedin" | "instagram">(step.channel as "email" | "linkedin" | "instagram");
  const [delay, setDelay] = React.useState(step.delayDays);
  const [context, setContext] = React.useState(step.context ?? "");
  const [templateId, setTemplateId] = React.useState<string>(step.templateId ?? "");
  const [saving, setSaving] = React.useState(false);

  const channelTemplates = templates.filter((t) => t.channel === channel);
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          delayDays: delay,
          context: context || null,
          templateId: templateId || null,
        }),
      });
      const updated = (await res.json()) as CampaignStep;
      onUpdate(updated);
    } catch {
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger className="btn btn-ghost btn-sm text-muted-foreground">
        <Edit01Icon size={13} />
      </PopoverTrigger>
      <PopoverContent side="right" className="w-72 flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold text-foreground">Edit step</p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Channel</label>
          <select
            className="input text-[12px]"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as "email" | "linkedin" | "instagram");
              setTemplateId("");
            }}
          >
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Send on day</label>
          <input type="number" min={0} className="input text-[12px]" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </div>

        {/* Template selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Template</label>
          <select
            className="input text-[12px]"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">AI-generated (no template)</option>
            {channelTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.variantBBody ? " · A/B" : ""}
              </option>
            ))}
          </select>
          {selectedTemplate?.variantBBody && (
            <p className="text-[10px] text-accent flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              A/B test active — leads split 50/50 between variants
            </p>
          )}
          {!templateId && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">Claude writes a unique message for each lead based on their profile.</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI context hint</label>
          <textarea
            className="input text-[12px] resize-none"
            rows={3}
            placeholder="e.g. Reference their recent funding round, mention a specific pain point…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">Guides the AI on tone and angle for this step.</p>
        </div>

        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loading03Icon size={12} className="animate-spin" /> : "Save"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
