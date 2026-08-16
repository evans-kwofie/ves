import { Pen01Icon, Loading03Icon } from "hugeicons-react";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { CampaignStep, LinkedInType } from "~/db/queries/steps";
import { Template } from "~/db/queries/templates";

export function EditPopover({
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
  const [channel, setChannel] = useState<"email" | "linkedin" | "instagram" | "reddit">(
    step.channel as "email" | "linkedin" | "instagram" | "reddit",
  );
  const [linkedinType, setLinkedinType] = useState<LinkedInType>(step.linkedinType ?? "dm");
  const [delay, setDelay] = useState(step.delayDays);
  const [context, setContext] = useState(step.context ?? "");
  const [templateId, setTemplateId] = useState<string>(step.templateId ?? "");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

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
          linkedinType: channel === "linkedin" ? linkedinType : null,
          delayDays: isNaN(delay) ? 0 : delay,
          context: context || null,
          templateId: templateId || null,
        }),
      });
      const updated = (await res.json()) as CampaignStep;
      onUpdate(updated);
      setOpen(false);
    } catch {
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="btn btn-ghost btn-sm text-muted-foreground">
        <Pen01Icon size={13} />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-w-2xl mx-auto rounded-t-xl px-6 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>Edit step</SheetTitle>
          <SheetDescription>
            Update the channel, timing, and AI instructions for this step.
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
              onChange={(e) => {
                setChannel(e.target.value as "email" | "linkedin" | "instagram" | "reddit");
                setTemplateId("");
              }}
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="reddit">Reddit</option>
            </select>
          </div>

          {channel === "linkedin" && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                LinkedIn type
              </label>
              <div className="flex flex-col gap-2">
                {([
                  { value: "connect" as LinkedInType, label: "Connection Request", description: "Send a note alongside your connection request. Max 300 characters. Best for cold outreach to people you're not connected with yet." },
                  { value: "dm" as LinkedInType, label: "Direct Message", description: "Send a longer message. Only works if you're already connected. Use this for warmer follow-ups after connecting." },
                ] as const).map((opt) => (
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
                    <span className={`text-[12px] font-semibold ${linkedinType === opt.value ? "text-accent" : "text-foreground"}`}>
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
              Template
            </label>
            <select
              className="input text-[12px]"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">AI-generated (no template)</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.variantBBody ? " · A/B" : ""}
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
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Claude writes a unique message for each lead based on their profile.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              AI context hint
            </label>
            <Textarea
              rows={5}
              placeholder="e.g. Reference their recent funding round, mention a specific pain point…"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Guides the AI on tone and angle for this step.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6 px-0">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loading03Icon size={12} className="animate-spin" /> : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
