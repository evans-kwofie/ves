import * as React from "react";
import {
  Copy01Icon,
  FloppyDiskIcon,
  RefreshIcon,
  Add01Icon,
  ThumbsUpIcon,
  MessageMultiple01Icon,
  ArrowDataTransferHorizontalIcon,
  MailSend01Icon,
  PencilEdit01Icon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "~/components/ui/sheet";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

const ANGLE_PRESETS = [
  "Founder lessons",
  "Contrarian take",
  "Behind the scenes",
  "Hot take",
  "Story-driven",
  "What I wish I knew",
  "Lessons from failure",
  "Unpopular opinion",
];

interface LinkedInPostGeneratorProps {
  orgId: string;
  keywords: Keyword[];
}

export function LinkedInPostGenerator({ orgId, keywords }: LinkedInPostGeneratorProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedKeywordId, setSelectedKeywordId] = React.useState(keywords[0]?.id ?? "");
  const [selectedKeyword, setSelectedKeyword] = React.useState(keywords[0]?.keyword ?? "");
  const [customKeyword, setCustomKeyword] = React.useState("");
  const [angle, setAngle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const activeKeyword = keywords.length > 0 ? selectedKeyword : customKeyword;
  const charCount = content.length;
  const charMax = 3000;
  const charPercent = Math.min((charCount / charMax) * 100, 100);
  const charColor = charPercent > 90 ? "var(--destructive)" : charPercent > 70 ? "#f59e0b" : "var(--accent)";
  const previewText = !expanded && content.length > 300 ? content.slice(0, 300) + "…" : content;

  function selectKeyword(k: Keyword) {
    setSelectedKeywordId(k.id);
    setSelectedKeyword(k.keyword);
  }

  async function generate() {
    if (!activeKeyword) return;
    setGenerating(true);
    setContent("");
    setExpanded(false);
    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keyword: activeKeyword,
          angle: angle || undefined,
          keywordId: selectedKeywordId || undefined,
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (data.content) setContent(data.content);
      else toast.error("Failed to generate post");
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    try {
      await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keyword: activeKeyword,
          keywordId: selectedKeywordId || undefined,
          save: true,
          angle: angle || undefined,
        }),
      });
      toast.success("Post saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(content).then(() => toast.success("Copied to clipboard"));
  }

  return (
    <>
      {/* ── Empty state ── */}
      <EmptyState
        icon={<PencilEdit01Icon />}
        title="No posts yet"
        description="Generate LinkedIn posts from your tracked keywords, crafted in a founder voice and ready to publish."
        action={
          <Button onClick={() => setOpen(true)}>
            <Add01Icon size={13} />
            New post
          </Button>
        }
      />

      {/* ── Sheet ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Post Generator</SheetTitle>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-5">
            {/* Topic */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Topic</p>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => selectKeyword(k)}
                      className="px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors"
                      style={{
                        background: selectedKeywordId === k.id ? "var(--accent)" : "transparent",
                        color: selectedKeywordId === k.id ? "#fff" : "var(--muted-foreground)",
                        borderColor: selectedKeywordId === k.id ? "var(--accent)" : "var(--border)",
                      }}
                    >
                      {k.keyword}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className="input text-[13px]"
                  placeholder="Enter a topic or keyword..."
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                />
              )}
            </div>

            {/* Angle */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Angle <span className="normal-case font-normal tracking-normal">— optional</span>
              </p>
              <textarea
                className="input text-[13px]"
                placeholder="e.g. contrarian take, lessons from failure..."
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                style={{ minHeight: 72, resize: "vertical", lineHeight: 1.6 }}
              />
              <div className="flex flex-wrap gap-1.5">
                {ANGLE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAngle(angle === p ? "" : p)}
                    className="px-2 py-0.5 rounded text-[11px] border transition-colors"
                    style={{
                      background: angle === p ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                      color: angle === p ? "var(--accent)" : "var(--muted-foreground)",
                      borderColor: angle === p ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={generate} disabled={generating || !activeKeyword}>
              {generating ? <><span className="spinner" /> Generating...</> : "Generate post"}
            </Button>

            {/* Output */}
            {content && !generating && (
              <div className="flex flex-col gap-4 content-reveal">
                {/* LinkedIn preview card */}
                <div className="card p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: "var(--accent)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}>Y</div>
                    <div>
                      <p className="text-[12px] font-semibold text-foreground leading-tight">
                        Your Name <span className="font-normal text-muted-foreground">• 1st</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Founder · Just now</p>
                    </div>
                  </div>

                  <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word">
                    {previewText}
                    {content.length > 300 && (
                      <button
                        onClick={() => setExpanded(v => !v)}
                        className="text-muted-foreground font-semibold ml-1"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
                      >
                        {expanded ? "see less" : "see more"}
                      </button>
                    )}
                  </p>

                  <div className="flex border-t border-border pt-2" style={{ marginTop: 2 }}>
                    {[
                      { icon: <ThumbsUpIcon size={12} />, label: "Like" },
                      { icon: <MessageMultiple01Icon size={12} />, label: "Comment" },
                      { icon: <ArrowDataTransferHorizontalIcon size={12} />, label: "Repost" },
                      { icon: <MailSend01Icon size={12} />, label: "Send" },
                    ].map(({ icon, label }) => (
                      <div key={label} className="flex flex-1 items-center justify-center gap-1 py-1 text-[11px] text-muted-foreground">
                        {icon}{label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable + char count */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Edit</p>
                    <div className="flex items-center gap-1.5">
                      <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                        <circle cx="12" cy="12" r="9" fill="none" stroke={charColor} strokeWidth="2.5"
                          strokeDasharray={`${2 * Math.PI * 9}`}
                          strokeDashoffset={`${2 * Math.PI * 9 * (1 - charPercent / 100)}`}
                          style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s" }}
                        />
                      </svg>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{charMax - charCount}</span>
                    </div>
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="input"
                    style={{ minHeight: 140, lineHeight: 1.6, fontSize: 12, resize: "vertical" }}
                  />
                </div>
              </div>
            )}

            {generating && (
              <div className="flex items-center justify-center gap-2 py-10 content-reveal">
                <span className="spinner" />
                <span className="text-[12px] text-muted-foreground">Writing your post...</span>
              </div>
            )}
          </SheetBody>

          {content && !generating && (
            <SheetFooter className="flex-row gap-2">
              <Button variant="ghost" onClick={copy}>
                <Copy01Icon size={13} /> Copy
              </Button>
              <Button variant="ghost" onClick={save} disabled={saving}>
                <FloppyDiskIcon size={13} /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" onClick={generate} disabled={generating} style={{ marginLeft: "auto" }}>
                <RefreshIcon size={13} /> Regenerate
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
