import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Add01Icon,
  Delete02Icon,
  CheckmarkCircle02Icon,
} from "hugeicons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button, buttonVariants } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { authClient } from "~/lib/auth-client";
import { toast } from "sonner";
import type { EmailSignature } from "~/types/signature";

export function SignaturesTab({
  orgId,
  metadata,
  initialSignatures,
}: {
  orgId: string;
  metadata: Record<string, unknown>;
  initialSignatures: EmailSignature[];
}) {
  const [signatures, setSignatures] =
    React.useState<EmailSignature[]>(initialSignatures);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function persistSignatures(next: EmailSignature[]) {
    const result = await authClient.organization.update({
      organizationId: orgId,
      data: { metadata: { ...metadata, emailSignatures: next } },
    });
    if (result.error) {
      toast.error(result.error.message ?? "Failed to save");
      return false;
    }
    return true;
  }

  async function addSignature() {
    if (!newName.trim() || !newContent.trim()) return;
    setSaving(true);
    const sig: EmailSignature = {
      id: uuidv4(),
      name: newName.trim(),
      content: newContent.trim(),
      isDefault: signatures.length === 0,
    };
    const next = [...signatures, sig];
    const ok = await persistSignatures(next);
    setSaving(false);
    if (!ok) return;
    setSignatures(next);
    setNewName("");
    setNewContent("");
    setAddOpen(false);
    toast.success("Signature saved");
  }

  async function deleteSignature(id: string) {
    const filtered = signatures.filter((s) => s.id !== id);
    const next = filtered.map((s, i) => ({
      ...s,
      isDefault: i === 0 ? true : s.isDefault,
    }));
    if (!next.some((s) => s.isDefault) && next.length > 0)
      next[0].isDefault = true;
    const ok = await persistSignatures(next);
    if (!ok) return;
    setSignatures(next);
    toast.success("Signature deleted");
  }

  async function setDefault(id: string) {
    const next = signatures.map((s) => ({ ...s, isDefault: s.id === id }));
    const ok = await persistSignatures(next);
    if (!ok) return;
    setSignatures(next);
    toast.success("Default updated");
  }

  if (signatures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-[13px] font-medium">No signatures yet</p>
        <p className="text-[12px] text-muted-foreground max-w-xs">
          Create one and it will be auto-appended to your outreach emails.
        </p>
        <Popover
          open={addOpen}
          onOpenChange={(open) => { if (!saving) setAddOpen(open); }}
        >
          <PopoverTrigger className={buttonVariants()}>
            <Add01Icon size={13} />
            Add signature
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" className="w-96">
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold">New signature</p>
              <input
                className="input text-[13px]"
                placeholder="Name (e.g. Formal, Casual)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Textarea
                className="text-[13px] leading-relaxed"
                rows={5}
                placeholder={"Best,\nYour Name\nTitle · Company\nwebsite.com"}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={addSignature} disabled={saving || !newName.trim() || !newContent.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => { setAddOpen(false); setNewName(""); setNewContent(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {signatures.map((sig) => (
        <div
          key={sig.id}
          className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium">{sig.name}</span>
              {sig.isDefault && (
                <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!sig.isDefault && (
                <button
                  className="btn btn-ghost btn-sm"
                  title="Set as default"
                  onClick={() => setDefault(sig.id)}
                >
                  <CheckmarkCircle02Icon size={13} />
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                title="Delete"
                onClick={() => deleteSignature(sig.id)}
              >
                <Delete02Icon size={13} />
              </button>
            </div>
          </div>
          <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {sig.content}
          </pre>
        </div>
      ))}

      <Popover
        open={addOpen}
        onOpenChange={(open) => {
          if (!saving) setAddOpen(open);
        }}
      >
        <PopoverTrigger >
          <Button>
            <Add01Icon size={13} />
            Add signature
          </Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-96">
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-semibold">New signature</p>
            <input
              className="input text-[13px]"
              placeholder="Name (e.g. Formal, Casual)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <Textarea
              className="text-[13px] leading-relaxed"
              rows={5}
              placeholder={"Best,\nYour Name\nTitle · Company\nwebsite.com"}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={addSignature}
                disabled={saving || !newName.trim() || !newContent.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddOpen(false);
                  setNewName("");
                  setNewContent("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
