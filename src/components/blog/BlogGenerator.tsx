import * as React from "react";
import { AiMagicIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";
import type { Keyword } from "~/types/keyword";

interface BlogGeneratorProps {
  orgId: string;
  keywords: Keyword[];
  onGenerated: (post: BlogPost) => void;
}

export function BlogGenerator({ orgId, keywords, onGenerated }: BlogGeneratorProps) {
  const [selectedKeywordIds, setSelectedKeywordIds] = React.useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = React.useState("");
  const [angle, setAngle] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  function toggleKeyword(id: string) {
    setSelectedKeywordIds((prev) => prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]);
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
      if (data.post) { onGenerated(data.post); toast.success("Post generated and saved"); }
      else { toast.error(data.error ?? "Failed to generate post"); }
    } catch { toast.error("Network error"); }
    finally { setGenerating(false); }
  }

  return (
    <div className="card p-5 mb-5">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Generate Blog Post</p>

      {keywords.length > 0 && (
        <div className="form-group">
          <Label>Keywords</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {keywords.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKeyword(k.id)}
                className={`px-3 py-1 rounded-[var(--radius)] text-[12px] cursor-pointer transition-all ${
                  selectedKeywordIds.includes(k.id)
                    ? "bg-[var(--accent-subtle)] border border-[var(--accent)] text-[var(--accent)]"
                    : "bg-[var(--muted)] border border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {k.keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <Label>Additional keywords <span className="font-normal text-[var(--muted-foreground)]">— comma-separated</span></Label>
        <Input value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} placeholder="e.g. email deliverability, B2B SaaS" />
      </div>

      <div className="form-group">
        <Label>Angle / Focus <span className="font-normal text-[var(--muted-foreground)]">— optional</span></Label>
        <Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="e.g. common mistakes, how-to guide, case study" />
      </div>

      <Button onClick={generate} disabled={generating || selectedKeywordTexts.length === 0}>
        {generating ? <><span className="spinner" />Generating...</> : <><AiMagicIcon size={13} />Generate & Save</>}
      </Button>
    </div>
  );
}
