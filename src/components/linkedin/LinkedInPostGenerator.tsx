import * as React from "react";
import { Copy, Save, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface LinkedInPostGeneratorProps {
  keywords: Keyword[];
}

export function LinkedInPostGenerator({ keywords }: LinkedInPostGeneratorProps) {
  const [selectedKeyword, setSelectedKeyword] = React.useState(keywords[0]?.keyword ?? "");
  const [selectedKeywordId, setSelectedKeywordId] = React.useState(keywords[0]?.id ?? "");
  const [angle, setAngle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function handleKeywordChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const k = keywords.find((kw) => kw.id === e.target.value);
    if (k) {
      setSelectedKeyword(k.keyword);
      setSelectedKeywordId(k.id);
    }
  }

  async function generate() {
    if (!selectedKeyword) return;
    setGenerating(true);
    setContent("");
    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: selectedKeyword,
          angle: angle || undefined,
          keywordId: selectedKeywordId || undefined,
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (data.content) {
        setContent(data.content);
      } else {
        toast.error("Failed to generate post");
      }
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
          keyword: selectedKeyword,
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
    navigator.clipboard.writeText(content).then(() => toast.success("Copied!"));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div className="form-group">
          <Label>Keyword</Label>
          {keywords.length > 0 ? (
            <select className="input" value={selectedKeywordId} onChange={handleKeywordChange}>
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={selectedKeyword}
              onChange={(e) => setSelectedKeyword(e.target.value)}
              placeholder="Topic or keyword..."
            />
          )}
        </div>

        <div className="form-group">
          <Label>Angle / Context (optional)</Label>
          <Input
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. founder lessons, contrarian take, behind the scenes"
          />
        </div>

        <Button onClick={generate} disabled={generating || !selectedKeyword}>
          {generating ? (
            <>
              <span className="spinner" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Post
            </>
          )}
        </Button>
      </div>

      {content && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted-foreground)",
              marginBottom: 8,
            }}
          >
            Generated Post
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ minHeight: 280, fontFamily: "inherit", lineHeight: 1.7 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="ghost" size="sm" onClick={copy}>
              <Copy size={13} />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={save} disabled={saving}>
              <Save size={13} />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
