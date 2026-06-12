import * as React from "react";
import { Button } from "~/components/ui/button";
import { Edit01Icon, Delete02Icon, Loading03Icon } from "hugeicons-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { toast } from "sonner";
import type { CampaignStep } from "~/db/queries/steps";

export function StepPopover({
  step,
  campaignId,
  onUpdate,
  onDelete,
}: {
  step: CampaignStep;
  campaignId: string;
  onUpdate: (s: CampaignStep) => void;
  onDelete: (id: string) => void;
}) {
  const [channel, setChannel] = React.useState<"email" | "linkedin">(step.channel as "email" | "linkedin");
  const [delay, setDelay] = React.useState(step.delayDays);
  const [context, setContext] = React.useState(step.context ?? "");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, delayDays: delay, context: context || null }),
      });
      const updated = (await res.json()) as CampaignStep;
      onUpdate(updated);
    } catch {
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/steps/${step.id}`, { method: "DELETE" });
      onDelete(step.id);
    } catch {
      toast.error("Failed to delete step");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger className="btn btn-ghost btn-sm text-muted-foreground">
        <Edit01Icon size={13} />
      </PopoverTrigger>
      <PopoverContent side="right" className="w-64 flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold text-foreground">Edit step</p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Channel</label>
          <select className="input text-[12px]" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin")}>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Send on day</label>
          <input type="number" min={0} className="input text-[12px]" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI context hint</label>
          <textarea
            className="input text-[12px] resize-none"
            rows={3}
            placeholder="e.g. Reference their recent funding round, mention a specific pain point, keep it short and genuine..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">Guides the AI on tone and angle for this specific step.</p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loading03Icon size={12} className="animate-spin" /> : "Save"}
          </Button>
          <button className="btn btn-ghost btn-sm text-red-400 ml-auto" onClick={remove} disabled={deleting}>
            {deleting ? <Loading03Icon size={12} className="animate-spin" /> : <Delete02Icon size={13} />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
