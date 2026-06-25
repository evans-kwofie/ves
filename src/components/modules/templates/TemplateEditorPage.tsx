import * as React from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft01Icon, Mail01Icon, Linkedin01Icon, InstagramIcon, TestTube01Icon } from "hugeicons-react";
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
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#10b981", "#3b82f6", "#14b8a6", "#f59e0b",
];

interface TemplateEditorPageProps {
  template?: Template | null;
  orgId: string;
  orgName?: string;
  orgLogo?: string | null;
  signerName?: string;
  onBack: () => void;
}

export function TemplateEditorPage({
  template,
  orgId,
  orgName,
  orgLogo,
  signerName,
  onBack,
}: TemplateEditorPageProps) {
  const router = useRouter();
  const isEditing = !!template;
  const bodyARef = React.useRef<HTMLTextAreaElement>(null);
  const bodyBRef = React.useRef<HTMLTextAreaElement>(null);

  // Shared fields
  const [name, setName] = React.useState(template?.name ?? "");
  const [channel, setChannel] = React.useState<Channel>(template?.channel ?? "email");
  const [brandColor, setBrandColor] = React.useState(template?.brandColor ?? BRAND_COLORS[0]);
  const [showLogo, setShowLogo] = React.useState(template?.showLogo ?? true);

  // Variant A (primary)
  const [subjectA, setSubjectA] = React.useState(template?.subject ?? "");
  const [bodyA, setBodyA] = React.useState(template?.body ?? "");

  // Variant B (A/B testing)
  const hasVariantB = !!(template?.variantBBody);
  const [abEnabled, setAbEnabled] = React.useState(hasVariantB);
  const [activeVariant, setActiveVariant] = React.useState<"a" | "b">("a");
  const [subjectB, setSubjectB] = React.useState(template?.variantBSubject ?? "");
  const [bodyB, setBodyB] = React.useState(template?.variantBBody ?? "");

  const [saving, setSaving] = React.useState(false);

  const isEmail = channel === "email";
  const activeSubject = activeVariant === "a" ? subjectA : subjectB;
  const activeBody = activeVariant === "a" ? bodyA : bodyB;
  const activeBodyRef = activeVariant === "a" ? bodyARef : bodyBRef;
  const setActiveSubject = activeVariant === "a" ? setSubjectA : setSubjectB;
  const setActiveBody = activeVariant === "a" ? setBodyA : setBodyB;

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
        subject: isEmail ? subjectA.trim() || null : null,
        body: bodyA,
        brandColor: isEmail ? brandColor : null,
        showLogo: isEmail ? showLogo : false,
        variantBSubject: abEnabled && isEmail ? subjectB.trim() || null : null,
        variantBBody: abEnabled ? bodyB.trim() || null : null,
      };

      if (isEditing) {
        await fetch(`/api/templates/${template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/templates/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId, ...payload }),
        });
      }

      toast.success(isEditing ? "Template saved" : "Template created");
      await router.invalidate();
      onBack();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-5 h-12 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
        >
          <ArrowLeft01Icon size={15} />
        </button>
        <h1 className="text-[14px] font-semibold flex-1">
          {isEditing ? "Edit template" : "New template"}
        </h1>
        {abEnabled && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-2 py-1">
            <TestTube01Icon size={10} />
            A/B Test
          </span>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Create template"}
        </Button>
      </div>

      {/* Two columns */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
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

          {/* Branding — email only, shared across variants */}
          {isEmail && (
            <div className={`flex flex-col gap-3 p-4 rounded-xl border border-card-border bg-card ${abEnabled ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Branding
                </p>
                {abEnabled && (
                  <span className="text-[10px] text-muted-foreground">Locked during A/B test</span>
                )}
              </div>

              {(orgLogo || orgName) && (
                <label className={`flex items-center gap-2.5 ${abEnabled ? "pointer-events-none" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={showLogo}
                    onChange={(e) => setShowLogo(e.target.checked)}
                    disabled={abEnabled}
                    className="w-3.5 h-3.5 accent-accent"
                  />
                  <span className="text-[13px]">
                    Show org header in email
                    <span className="text-muted-foreground font-normal"> (recommended — helps leads recognise your brand)</span>
                  </span>
                  {orgLogo && (
                    <img src={orgLogo} alt="" className="h-5 object-contain opacity-60 ml-auto" />
                  )}
                </label>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-[12px] text-muted-foreground">Accent colour</span>
                <div className={`flex items-center gap-2 ${abEnabled ? "pointer-events-none" : ""}`}>
                  {BRAND_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBrandColor(c)}
                      disabled={abEnabled}
                      className="size-6 rounded-full border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: brandColor === c ? c : "transparent",
                        outline: brandColor === c ? `2px solid ${c}` : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    disabled={abEnabled}
                    className="size-6 rounded-full border border-border cursor-pointer bg-transparent p-0 disabled:cursor-not-allowed"
                    title="Custom colour"
                  />
                </div>
              </div>
            </div>
          )}

          {/* A/B toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-card-border bg-card">
            <div className="flex items-center gap-2">
              <TestTube01Icon size={14} className="text-muted-foreground" />
              <div>
                <p className="text-[12px] font-medium">A/B testing</p>
                <p className="text-[11px] text-muted-foreground">Write two variants — leads are split 50/50 when used in a campaign</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={abEnabled}
              onClick={() => {
                setAbEnabled(!abEnabled);
                if (!abEnabled) setActiveVariant("a");
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${abEnabled ? "bg-accent" : "bg-muted"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${abEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>

          {/* Variant tabs (only when A/B enabled) */}
          {abEnabled && (
            <div className="flex gap-1">
              {(["a", "b"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveVariant(v)}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors",
                    activeVariant === v
                      ? "border-accent bg-accent-subtle text-accent"
                      : "border-border text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Variant {v.toUpperCase()}
                  {v === "a" && <span className="text-[9px] text-muted-foreground font-normal">(primary)</span>}
                </button>
              ))}
            </div>
          )}

          {/* Subject — per variant, email only */}
          {isEmail && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Subject line
                {abEnabled && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">Variant {activeVariant.toUpperCase()}</span>}
              </Label>
              <Input
                key={activeVariant + "-subject"}
                value={activeSubject}
                onChange={(e) => setActiveSubject(e.target.value)}
                placeholder="e.g. Quick question about {{company}}"
              />
            </div>
          )}

          {/* Body — per variant */}
          <div className="flex flex-col gap-2">
            <Label>
              Message body
              {abEnabled && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">Variant {activeVariant.toUpperCase()}</span>}
            </Label>
            <TokenPicker textareaRef={activeBodyRef} value={activeBody} onChange={setActiveBody} />
            <textarea
              key={activeVariant + "-body"}
              ref={activeBodyRef}
              value={activeBody}
              onChange={(e) => setActiveBody(e.target.value)}
              placeholder={
                channel === "instagram"
                  ? "Keep it casual and under 1,000 characters…"
                  : channel === "linkedin"
                    ? "Keep it concise — 300 chars for connection notes, 2,000 for follow-ups…"
                    : "Hi {{firstName}},\n\nI came across {{company}} and…"
              }
              rows={12}
              className="input resize-none font-mono text-[12px] leading-relaxed"
            />
            {channel !== "email" && (
              <span
                className={`text-[11px] self-end ${activeBody.length > (channel === "instagram" ? 1000 : 2000) ? "text-destructive" : "text-muted-foreground"}`}
              >
                {activeBody.length} / {channel === "instagram" ? "1,000" : "2,000"}
              </span>
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="w-115 overflow-y-auto p-6 border-l border-border bg-muted/20 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Preview
            </p>
            {abEnabled && (
              <div className="flex gap-1">
                {(["a", "b"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveVariant(v)}
                    className={[
                      "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                      activeVariant === v ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          <TemplatePreview
            template={{
              subject: activeSubject,
              body: activeBody,
              channel,
              brandColor,
              showLogo,
            }}
            orgName={orgName}
            orgLogo={orgLogo}
            signerName={signerName}
          />
        </div>
      </div>
    </div>
  );
}
