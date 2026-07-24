import * as React from "react";
import { FlashIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "~/components/ui/sheet";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";
import type { Keyword } from "~/types/keyword";

interface BlogGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  keywords: Keyword[];
  onGenerated: (post: BlogPost) => void;
}

export function BlogGenerator({ open, onOpenChange, orgId, keywords, onGenerated }: BlogGeneratorProps) {
  const [selectedKeywordIds, setSelectedKeywordIds] = React.useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = React.useState("");
  const [angle, setAngle] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  function toggleKeyword(id: string) {
    setSelectedKeywordIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  }

  const selectedKeywordTexts = [
    ...keywords.filter((k) => selectedKeywordIds.includes(k.id)).map((k) => k.keyword),
    ...(customKeyword.trim() ? customKeyword.split(",").map((s) => s.trim()).filter(Boolean) : []),
  ];

  async function generate() {
    if (selectedKeywordTexts.length === 0) { toast.error("Select at least one keyword"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, keywords: selectedKeywordTexts, angle: angle || undefined, save: true }),
      });
      const data = (await res.json()) as { post?: BlogPost; error?: string };
      if (data.post) {
        onGenerated(data.post);
        toast.success("Post generated and saved");
        onOpenChange(false);
        setSelectedKeywordIds([]);
        setCustomKeyword("");
        setAngle("");
      } else {
        toast.error(data.error ?? "Failed to generate post");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Generate Blog Post</SheetTitle>
          <SheetDescription>AI writes a full post from your keywords.</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {keywords.length > 0 && (
              <div>
                <p className="form-label">Keywords</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {keywords.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKeyword(k.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "var(--radius)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                        transition: "all 0.15s",
                        border: selectedKeywordIds.includes(k.id) ? "1px solid var(--accent)" : "1px solid var(--border)",
                        background: selectedKeywordIds.includes(k.id) ? "var(--accent-subtle)" : "transparent",
                        color: selectedKeywordIds.includes(k.id) ? "var(--accent)" : "var(--muted-foreground)",
                      }}
                    >
                      {k.keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="form-label">
                Additional keywords{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)" }}>
                  — comma-separated
                </span>
              </p>
              <Input
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                placeholder="e.g. email deliverability, B2B SaaS"
                style={{ marginTop: 6 }}
              />
            </div>

            <div>
              <p className="form-label">
                Angle / Focus{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)" }}>
                  — optional
                </span>
              </p>
              <Input
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. common mistakes, how-to guide, case study"
                style={{ marginTop: 6 }}
              />
            </div>

          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            onClick={generate}
            disabled={generating || selectedKeywordTexts.length === 0}
            style={{ width: "100%" }}
          >
            {generating ? (
              <><span className="spinner" />Generating...</>
            ) : (
              <><FlashIcon size={13} />Generate & Save</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
