import * as React from "react";
import { Mail01Icon, Linkedin01Icon, InstagramIcon } from "hugeicons-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { TokenPicker } from "./TokenPicker";
import { TemplatePreview } from "./TemplatePreview";
import { toast } from "sonner";
import type { Template } from "~/db/queries/templates";

type Channel = "email" | "linkedin" | "instagram";

const CHANNELS: { value: Channel; label: string; icon: React.ReactNode }[] = [
  { value: "email", label: "Email", icon: <Mail01Icon size={13} /> },
  { value: "linkedin", label: "LinkedIn", icon: <Linkedin01Icon size={13} /> },
  { value: "instagram", label: "Instagram", icon: <InstagramIcon size={13} /> },
];

const BRAND_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#10b981",
  "#3b82f6",
  "#14b8a6",
  "#f59e0b",
];

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  orgId: string;
  orgName?: string;
  orgLogo?: string | null;
  signerName?: string;
  onSaved: (template: Template) => void;
}

export function TemplateEditor({
  open,
  onOpenChange,
  template,
  orgId,
  orgName,
  orgLogo,
  signerName,
  onSaved,
}: TemplateEditorProps) {
  const isEditing = !!template;
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const [name, setName] = React.useState(template?.name ?? "");
  const [channel, setChannel] = React.useState<Channel>(
    template?.channel ?? "email",
  );
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [body, setBody] = React.useState(template?.body ?? "");
  const [brandColor, setBrandColor] = React.useState(
    template?.brandColor ?? BRAND_COLORS[0],
  );
  const [showLogo, setShowLogo] = React.useState(template?.showLogo ?? true);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const [saving, setSaving] = React.useState(false);

  // Sync fields when template prop changes
  React.useEffect(() => {
    setName(template?.name ?? "");
    setChannel(template?.channel ?? "email");
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
    setBrandColor(template?.brandColor ?? BRAND_COLORS[0]);
    setShowLogo(template?.showLogo ?? true);
    setTab("edit");
  }, [template, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        channel,
        subject: channel === "email" ? subject.trim() || null : null,
        body,
        brandColor: channel === "email" ? brandColor : null,
        showLogo: channel === "email" ? showLogo : false,
      };

      let saved: Template;
      if (isEditing) {
        await fetch(`/api/templates/${template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        saved = {
          ...template,
          ...payload,
          brandColor: payload.brandColor,
          showLogo: payload.showLogo,
        };
      } else {
        const res = await fetch("/api/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId, ...payload }),
        });
        saved = (await res.json()) as Template;
      }

      toast.success(isEditing ? "Template saved" : "Template created");
      onSaved(saved);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  const isEmail = channel === "email";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-4xl flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle>
            {isEditing ? "Edit template" : "New template"}
          </SheetTitle>
        </SheetHeader>

        {/* Edit / Preview toggle */}
        <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="tab-trigger"
              data-state={tab === t ? "active" : "inactive"}
            >
              {t === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "edit" ? (
            <div className="flex flex-col gap-5">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label>Template name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cold intro — SaaS founders"
                />
              </div>

              {/* Channel */}
              <div className="flex flex-col gap-1.5">
                <Label>Channel</Label>
                <div className="flex gap-2">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setChannel(c.value)}
                      className={[
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors",
                        channel === c.value
                          ? "border-accent bg-accent-subtle text-accent"
                          : "border-border text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {c.icon}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding — email only */}
              {isEmail && (
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-card-border bg-card">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Branding
                  </p>

                  {/* Show logo toggle */}
                  {(orgLogo || orgName) && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => setShowLogo(e.target.checked)}
                        className="w-3.5 h-3.5 accent-accent"
                      />
                      <span className="text-[13px]">
                        Show org logo in header
                      </span>
                      {orgLogo && (
                        <img
                          src={orgLogo}
                          alt=""
                          className="h-5 object-contain opacity-60 ml-auto"
                        />
                      )}
                    </label>
                  )}

                  {/* Brand colour */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[12px] text-muted-foreground">
                      Accent colour
                    </span>
                    <div className="flex items-center gap-2">
                      {BRAND_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBrandColor(c)}
                          className="size-6 rounded-full border-2 transition-all"
                          style={{
                            background: c,
                            borderColor: brandColor === c ? c : "transparent",
                            outline:
                              brandColor === c ? `2px solid ${c}` : "none",
                            outlineOffset: 2,
                          }}
                        />
                      ))}
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="size-6 rounded-full border border-border cursor-pointer bg-transparent p-0"
                        title="Custom colour"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subject — email only */}
              {isEmail && (
                <div className="flex flex-col gap-1.5">
                  <Label>Subject line</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Quick question about {{company}}"
                  />
                </div>
              )}

              {/* Body */}
              <div className="flex flex-col gap-2">
                <Label>Message body</Label>
                <TokenPicker
                  textareaRef={bodyRef}
                  value={body}
                  onChange={setBody}
                />
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    channel === "instagram"
                      ? "Keep it casual and under 1,000 characters…"
                      : channel === "linkedin"
                        ? "Keep it concise — 300 chars for connection notes, 2,000 for follow-ups…"
                        : "Hi {{firstName}},\n\nI came across {{company}} and…"
                  }
                  rows={10}
                  className="input resize-none font-mono text-[12px] leading-relaxed"
                />
                {channel !== "email" && (
                  <span
                    className={`text-[11px] self-end ${body.length > (channel === "instagram" ? 1000 : 2000) ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {body.length} /{" "}
                    {channel === "instagram" ? "1,000" : "2,000"}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <TemplatePreview
              template={{ subject, body, channel, brandColor, showLogo }}
              orgName={orgName}
              orgLogo={orgLogo}
              signerName={signerName}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Create template"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
