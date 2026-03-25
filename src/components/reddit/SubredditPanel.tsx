import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import type { Keyword, Subreddit } from "~/types/keyword";

interface SubredditPanelProps {
  keywords: Keyword[];
  onKeywordsChange: (keywords: Keyword[]) => void;
}

export function SubredditPanel({ keywords, onKeywordsChange }: SubredditPanelProps) {
  const [selectedKeywordId, setSelectedKeywordId] = React.useState<string | null>(
    keywords[0]?.id ?? null,
  );
  const [newSubreddit, setNewSubreddit] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

  async function addSubreddit() {
    if (!newSubreddit.trim() || !selectedKeywordId) return;
    setAdding(true);
    try {
      const res = await fetch("/api/subreddits/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId: selectedKeywordId, name: newSubreddit.trim() }),
      });
      const sub = (await res.json()) as Subreddit;
      onKeywordsChange(
        keywords.map((k) =>
          k.id === selectedKeywordId
            ? { ...k, subreddits: [...(k.subreddits ?? []), sub] }
            : k,
        ),
      );
      setNewSubreddit("");
      toast.success(`Added r/${sub.name}`);
    } catch {
      toast.error("Failed to add subreddit");
    } finally {
      setAdding(false);
    }
  }

  async function removeSubreddit(subId: string) {
    setDeletingId(subId);
    try {
      await fetch(`/api/subreddits/${subId}`, { method: "DELETE" });
      onKeywordsChange(
        keywords.map((k) =>
          k.id === selectedKeywordId
            ? { ...k, subreddits: (k.subreddits ?? []).filter((s) => s.id !== subId) }
            : k,
        ),
      );
      toast.success("Subreddit removed");
    } catch {
      toast.error("Failed to remove subreddit");
    } finally {
      setDeletingId(null);
    }
  }

  if (keywords.length === 0) {
    return (
      <div style={{ color: "var(--muted-foreground)", fontSize: 12, padding: "12px 0" }}>
        Add keywords first to manage subreddits.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="form-group">
        <label className="form-label">Keyword</label>
        <select
          className="input"
          value={selectedKeywordId ?? ""}
          onChange={(e) => setSelectedKeywordId(e.target.value)}
        >
          {keywords.map((k) => (
            <option key={k.id} value={k.id}>
              {k.keyword}
            </option>
          ))}
        </select>
      </div>

      {selectedKeyword && (
        <>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>
              Subreddits ({(selectedKeyword.subreddits ?? []).length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(selectedKeyword.subreddits ?? []).map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "var(--muted)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>r/{sub.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSubreddit(sub.id)}
                    disabled={deletingId === sub.id}
                    style={{ padding: "2px 4px", color: "var(--muted-foreground)" }}
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <Input
              placeholder="subreddit name"
              value={newSubreddit}
              onChange={(e) => setNewSubreddit(e.target.value)}
              disabled={adding}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubreddit();
                }
              }}
            />
            <Button size="sm" onClick={addSubreddit} disabled={adding || !newSubreddit.trim()}>
              <Plus size={13} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
