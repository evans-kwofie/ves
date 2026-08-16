import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Add01Icon, Loading03Icon } from "hugeicons-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "~/components/ui/sheet";
import { toast } from "sonner";
import type { CampaignStep, LinkedInType } from "~/db/queries/steps";
import { CHANNEL_LIST, CHANNEL_META } from "~/lib/channels";
import type { Channel } from "~/lib/channels";

export function AddStepPopover({
  campaignId,
  steps,
  allowedChannels,
  onAdd,
}: {
  campaignId: string;
  steps: CampaignStep[];
  allowedChannels: Channel[];
  onAdd: (step: CampaignStep) => void;
}) {
  const channels =
    allowedChannels.length > 0 ? allowedChannels : [...CHANNEL_LIST];
  const [channel, setChannel] = React.useState<Channel>(channels[0]);
  const [linkedinType, setLinkedinType] = React.useState<LinkedInType>("dm");
  const [delay, setDelay] = React.useState(0);
  const [context, setContext] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [open, setOpen] = React.useState(false);

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
        body: JSON.stringify({
          stepNumber: steps.length + 1,
          delayDays: isNaN(delay) ? 0 : delay,
          channel,
          linkedinType: channel === "linkedin" ? linkedinType : null,
          context: context.trim() || null,
        }),
      });
      const step = (await res.json()) as CampaignStep;
      onAdd(step);
      setContext("");
      setOpen(false);
    } catch {
      toast.error("Failed to add step");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded text-[12px] text-muted-foreground cursor-pointer bg-transparent hover:text-foreground transition-colors">
        <Add01Icon size={13} />
        Add step
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-w-2xl mx-auto rounded-t-xl px-6 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle>New step</SheetTitle>
          <SheetDescription>
            Choose a channel and configure when this step sends. The AI will write a personalised message for each contact.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Channel
            </label>
            <select
              className="input text-[12px]"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              {channels.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_META[c].label}
                </option>
              ))}
            </select>
          </div>

          {channel === "linkedin" && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                LinkedIn type
              </label>
              <div className="flex flex-col gap-2">
                {(
                  [
                    {
                      value: "connect" as LinkedInType,
                      label: "Connection Request",
                      description:
                        "Send a note alongside your connection request. Max 300 characters. Best for cold outreach to people you're not connected with yet.",
                    },
                    {
                      value: "dm" as LinkedInType,
                      label: "Direct Message",
                      description:
                        "Send a longer message. Only works if you're already connected. Use this for warmer follow-ups after connecting.",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLinkedinType(opt.value)}
                    className={[
                      "flex flex-col gap-1 p-3 rounded-lg border text-left transition-colors cursor-pointer",
                      linkedinType === opt.value
                        ? "border-accent bg-accent/5"
                        : "border-border bg-transparent hover:border-border/80",
                    ].join(" ")}
                  >
                    <span
                      className={`text-[12px] font-semibold ${linkedinType === opt.value ? "text-accent" : "text-foreground"}`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Send on day
            </label>
            <Input
              type="number"
              min={0}
              value={delay}
              onChange={(e) => setDelay(e.target.valueAsNumber)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              AI context hint
            </label>
            <Textarea
              rows={5}
              placeholder={
                steps.length === 0
                  ? "e.g. Introduce us, mention what we do, keep it short and curious..."
                  : "e.g. Follow up on the first email, softer tone, mention a specific use case..."
              }
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This tells the AI what angle to take when generating a draft for
              this step.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6 px-0">
          <Button onClick={handleAdd} disabled={adding}>
            {adding ? (
              <Loading03Icon size={12} className="animate-spin" />
            ) : (
              <Add01Icon size={12} />
            )}
            Add Step
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
