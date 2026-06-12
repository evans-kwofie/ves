import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Loading03Icon } from "hugeicons-react";
import { toast } from "sonner";
import { useComposeDraft } from "~/store/compose-draft";
import type { CampaignDraft } from "~/db/queries/drafts";

export function ComposeDraftPanel({ onDraftAdded }: { onDraftAdded: (draft: CampaignDraft) => void }) {
  const {
    isOpen, campaignId, leads, signatures,
    leadId, subject, body, signatureId, preview,
    close, setLeadId, setSubject, setBody, setSignatureId, setPreview,
  } = useComposeDraft();

  const [saving, setSaving] = React.useState(false);

  const selectedLead = leads.find((l) => l.id === leadId);
  const selectedSig = signatures.find((s) => s.id === signatureId);
  const previewBody = selectedSig ? `${body}\n\n${selectedSig.content}` : body;

  async function handleQueue() {
    if (!campaignId || !leadId || !body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, subject: subject.trim() || undefined, body: body.trim(), channel: "email" }),
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
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Lead */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Lead</label>
              <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company} — {l.ceo}{l.email ? ` (${l.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject line</label>
              <input
                className="input"
                placeholder="e.g. Quick question about [Company]"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Body</label>
              {preview ? (
                <div
                  className="input"
                  style={{ minHeight: 220, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.65, background: "var(--muted)", cursor: "default", overflowY: "auto" }}
                >
                  {previewBody}
                </div>
              ) : (
                <textarea
                  className="input"
                  style={{ minHeight: 220, resize: "vertical", fontSize: 13, lineHeight: 1.65 }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi ${selectedLead?.ceo ?? "[Founder's name]"},\n\n`}
                />
              )}
            </div>

            {/* Signature */}
            {signatures.length > 0 && (
              <div className="form-group" style={{ margin: 0 }}>
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
          <div style={{ display: "flex", gap: 8 }}>
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
