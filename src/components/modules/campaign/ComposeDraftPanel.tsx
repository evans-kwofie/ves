import * as React from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetBody, SheetFooter,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Loading03Icon, InformationCircleIcon } from "hugeicons-react";
import { toast } from "sonner";
import { useComposeDraft } from "~/store/compose-draft";
import type { CampaignDraft } from "~/db/queries/drafts";

export function ComposeDraftPanel({ onDraftAdded }: { onDraftAdded: (draft: CampaignDraft) => void }) {
  const {
    isOpen, campaignId, leads, signatures, steps,
    leadId, stepNumber, subject, body, signatureId, preview,
    close, setLeadId, setStepNumber, setSubject, setBody, setSignatureId, setPreview,
  } = useComposeDraft();

  const [saving, setSaving] = React.useState(false);

  const selectedLead = leads.find((l) => l.id === leadId);
  const selectedStep = steps.find((s) => s.stepNumber === stepNumber);
  const selectedSig = signatures.find((s) => s.id === signatureId);
  const previewBody = selectedSig ? `${body}\n\n${selectedSig.content}` : body;

  async function handleQueue() {
    if (!campaignId || !leadId || !body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          subject: subject.trim() || undefined,
          body: body.trim(),
          channel: selectedStep?.channel ?? "email",
          stepNumber: stepNumber ?? undefined,
        }),
      });
      if (!res.ok) { toast.error("Failed to add draft"); return; }
      const draft = (await res.json()) as CampaignDraft;
      onDraftAdded(draft);
      toast.success(`Draft queued for ${selectedLead?.company ?? "lead"}`);
      close();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Compose Draft</SheetTitle>
          <SheetDescription>Manually write a draft and add it to the review queue.</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="flex flex-col gap-5">
          {/* Lead */}
          <div className="flex flex-col gap-1">
            <label className="form-label">Lead</label>
            <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company}{l.ceo ? ` — ${l.ceo}` : ""}{l.email ? ` (${l.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Step */}
          {steps.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="form-label">Step</label>
              <select
                className="input"
                value={stepNumber ?? ""}
                onChange={(e) => setStepNumber(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— No step —</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.stepNumber}>
                    Step {s.stepNumber} · {s.channel} · {s.delayDays === 0 ? "Immediately" : `Day ${s.delayDays}`}
                  </option>
                ))}
              </select>
              {/* AI context hint for selected step */}
              {selectedStep?.context && (
                <div className="flex items-start gap-2 rounded-md bg-accent-subtle px-3 py-2 mt-1">
                  <InformationCircleIcon size={13} className="text-accent mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                    {selectedStep.context}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div className="flex flex-col gap-1">
            <label className="form-label">Subject line</label>
            <input
              className="input"
              placeholder="e.g. Quick question about [Company]"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1">
            <label className="form-label">Body</label>
            {preview ? (
              <div className="input min-h-55 whitespace-pre-wrap text-[13px] leading-relaxed bg-muted cursor-default overflow-y-auto">
                {previewBody}
              </div>
            ) : (
              <textarea
                className="input min-h-55 resize-y text-[13px] leading-relaxed"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Hi ${selectedLead?.ceo ?? "[Founder's name]"},\n\n`}
              />
            )}
          </div>

          {/* Signature */}
          {signatures.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="form-label">Signature</label>
              <select className="input" value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
                <option value="">— No signature —</option>
                {signatures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          </div>
        </SheetBody>

        <SheetFooter>
          <div className="flex gap-2">
            <Button onClick={handleQueue} disabled={saving || !leadId || !body.trim()}>
              {saving && <Loading03Icon size={13} className="animate-spin" />}
              Add to Queue
            </Button>
            <Button variant="ghost" onClick={() => setPreview(!preview)}>
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
