import * as React from "react";
import { Sparkles } from "lucide-react";
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
    setSelectedKeywordIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  }

  const selectedKeywordTexts = [
    ...keywords.filter((k) => selectedKeywordIds.includes(k.id)).map((k) => k.keyword),
    ...(customKeyword.trim()
      ? customKeyword
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []),
  ];

  async function generate() {
    if (selectedKeywordTexts.length === 0) {
      toast.error("Select at least one keyword");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keywords: selectedKeywordTexts,
          angle: angle || undefined,
          save: true,
        }),
      });
      const data = (await res.json()) as { post?: BlogPost; content?: string; error?: string };
      if (data.post) {
        onGenerated(data.post);
        toast.success("Blog post generated and saved");
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
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-title">Generate Blog Post</div>

      {keywords.length > 0 && (
        <div className="form-group">
          <Label>Keywords</Label>
          <div className="tag-list" style={{ marginTop: 6 }}>
            {keywords.map((k) => (
              <button
                key={k.id}
                onClick={() => toggleKeyword(k.id)}
                style={{
                  background: selectedKeywordIds.includes(k.id)
                    ? "rgba(34, 197, 94, 0.15)"
                    : "var(--muted)",
                  border: selectedKeywordIds.includes(k.id)
                    ? "1px solid rgba(34, 197, 94, 0.3)"
                    : "1px solid transparent",
                  borderRadius: "var(--radius)",
                  padding: "4px 10px",
                  fontSize: 12,
                  color: selectedKeywordIds.includes(k.id)
                    ? "var(--accent)"
                    : "var(--muted-foreground)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {k.keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <Label>Additional keywords (comma-separated)</Label>
        <Input
          value={customKeyword}
          onChange={(e) => setCustomKeyword(e.target.value)}
          placeholder="e.g. email deliverability, B2B SaaS"
        />
      </div>

      <div className="form-group">
        <Label>Angle / Focus (optional)</Label>
        <Input
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="e.g. common mistakes, how-to guide, case study"
        />
      </div>

      <Button onClick={generate} disabled={generating || selectedKeywordTexts.length === 0}>
        {generating ? (
          <>
            <span className="spinner" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Generate & Save
          </>
        )}
      </Button>
    </div>
  );
}
