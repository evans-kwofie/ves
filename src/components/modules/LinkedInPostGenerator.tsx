import * as React from "react";
import { Copy01Icon, FloppyDiskIcon, AiMagicIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface LinkedInPostGeneratorProps {
  orgId: string;
  keywords: Keyword[];
}

export function LinkedInPostGenerator({ orgId, keywords }: LinkedInPostGeneratorProps) {
  const [selectedKeywordId, setSelectedKeywordId] = React.useState(keywords[0]?.id ?? "");
  const [selectedKeyword, setSelectedKeyword] = React.useState(keywords[0]?.keyword ?? "");
  const [angle, setAngle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function handleKeywordChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const k = keywords.find((kw) => kw.id === e.target.value);
    if (k) { setSelectedKeyword(k.keyword); setSelectedKeywordId(k.id); }
  }

  async function generate() {
    if (!selectedKeyword) return;
    setGenerating(true);
    setContent("");
    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, keyword: selectedKeyword, angle: angle || undefined, keywordId: selectedKeywordId || undefined }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (data.content) { setContent(data.content); }
      else { toast.error("Failed to generate post"); }
    } catch { toast.error("Network error"); }
    finally { setGenerating(false); }
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    try {
      await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, keyword: selectedKeyword, keywordId: selectedKeywordId || undefined, save: true, angle: angle || undefined }),
      });
      toast.success("Post saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <div className="form-group">
        <Label>Keyword</Label>
        {keywords.length > 0 ? (
          <select className="input" value={selectedKeywordId} onChange={handleKeywordChange}>
            {keywords.map((k) => <option key={k.id} value={k.id}>{k.keyword}</option>)}
          </select>
        ) : (
          <Input value={selectedKeyword} onChange={(e) => setSelectedKeyword(e.target.value)} placeholder="Topic or keyword..." />
        )}
      </div>

      <div className="form-group">
        <Label>Angle / Context <span className="font-normal text-[var(--muted-foreground)]">— optional</span></Label>
        <Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="e.g. founder lessons, contrarian take, behind the scenes" />
      </div>

      <Button onClick={generate} disabled={generating || !selectedKeyword} className="self-start">
        {generating ? <><span className="spinner" />Generating...</> : <><AiMagicIcon size={13} />Generate post</>}
      </Button>

      {content && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Generated post</p>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[260px] leading-relaxed" />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(content).then(() => toast.success("Copied!"))}>
              <Copy01Icon size={13} />Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={save} disabled={saving}>
              <FloppyDiskIcon size={13} />{saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
