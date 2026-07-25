import * as React from "react";
import { Button } from "~/components/ui/button";
import { Add01Icon, Loading03Icon } from "hugeicons-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { toast } from "sonner";
import type { CampaignStep } from "~/db/queries/steps";

export function AddStepPopover({
  campaignId,
  steps,
  onAdd,
}: {
  campaignId: string;
  steps: CampaignStep[];
  onAdd: (step: CampaignStep) => void;
}) {
  const lastDelay = steps[steps.length - 1]?.delayDays ?? -1;
  const [channel, setChannel] = React.useState<"email" | "linkedin" | "linkedin_connect" | "instagram">("email");
  const [delay, setDelay] = React.useState(lastDelay < 0 ? 0 : lastDelay + 3);
  const [context, setContext] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    const last = steps[steps.length - 1]?.delayDays ?? -1;
    setDelay(last < 0 ? 0 : last + 3);
  }, [steps.length]);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNumber: steps.length + 1, delayDays: delay, channel, context: context.trim() || null }),
      });
      const step = (await res.json()) as CampaignStep;
      onAdd(step);
      setOpen(false);
      setContext("");
    } catch {
      toast.error("Failed to add step");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded text-[12px] text-muted-foreground cursor-pointer bg-transparent hover:text-foreground transition-colors">
        <Add01Icon size={13} />
        Add step
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 flex flex-col gap-3 p-4">
        <p className="text-[12px] font-semibold text-foreground">New step</p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Channel</label>
          <select className="input text-[12px]" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin" | "linkedin_connect" | "instagram")}>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn DM</option>
            <option value="linkedin_connect">LinkedIn Connection Request</option>
            <option value="instagram">Instagram</option>
          </select>
          {channel === "linkedin_connect" && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">AI will generate a short connection note under 300 characters. You copy it and send manually on LinkedIn.</p>
          )}
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
            placeholder={steps.length === 0
              ? "e.g. Introduce us, mention what we do, keep it short and curious..."
              : "e.g. Follow up on the first email, softer tone, mention a specific use case..."}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">This tells the AI what angle to take when generating a draft for this step.</p>
        </div>

        <Button size="sm" onClick={handleAdd} disabled={adding}>
          {adding ? <Loading03Icon size={12} className="animate-spin" /> : <Add01Icon size={12} />}
          Add Step
        </Button>
      </PopoverContent>
    </Popover>
  );
}
