import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Add01Icon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  SignatureIcon,
} from "hugeicons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button, buttonVariants } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
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

  const addPopover = (
    <Popover
      open={addOpen}
      onOpenChange={(open) => {
        if (!saving) setAddOpen(open);
      }}
    >
      <PopoverTrigger className={buttonVariants({ size: "sm" })}>
        <Add01Icon size={13} />
        Add signature
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-96">
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
  );

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted-foreground">
          {signatures.length} signature{signatures.length !== 1 ? "s" : ""}
        </p>
        {addPopover}
      </div>

      {signatures.length === 0 ? (
        <EmptyState
          icon={<SignatureIcon />}
          title="No signatures yet"
          description="Signatures are auto-appended to your outreach emails."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {signatures.map((sig) => (
            <div
              key={sig.id}
              className="flex flex-col gap-2 p-4 rounded-xl border border-card-border bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{sig.name}</span>
                  {sig.isDefault && (
                    <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!sig.isDefault && (
                    <button
                      className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground"
                      title="Set as default"
                      onClick={() => setDefault(sig.id)}
                    >
                      <CheckmarkCircle02Icon size={13} />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => deleteSignature(sig.id)}
                  >
                    <Delete02Icon size={13} />
                  </button>
                </div>
              </div>
              <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed border-t border-border pt-2 mt-1">
                {sig.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
