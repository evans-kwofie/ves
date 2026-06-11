import * as React from "react";
import { Add01Icon, Delete01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "~/components/ui/sheet";
import { toast } from "sonner";
import type { Keyword, Subreddit } from "~/types/keyword";

interface SubredditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywords: Keyword[];
  onKeywordsChange: (keywords: Keyword[]) => void;
}

export function SubredditPanel({ open, onOpenChange, keywords, onKeywordsChange }: SubredditPanelProps) {
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
        body: JSON.stringify({ keywordId: selectedKeywordId, name: newSubreddit.trim().replace(/^r\//, "") }),
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Subreddits</SheetTitle>
          <SheetDescription>Manage which subreddits are monitored per keyword.</SheetDescription>
        </SheetHeader>

        <SheetBody>
          {keywords.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Add keywords first to manage subreddits.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Keyword selector */}
              <div>
                <p className="form-label">Keyword</p>
                <select
                  className="input"
                  style={{ marginTop: 6 }}
                  value={selectedKeywordId ?? ""}
                  onChange={(e) => setSelectedKeywordId(e.target.value)}
                >
                  {keywords.map((k) => (
                    <option key={k.id} value={k.id}>{k.keyword}</option>
                  ))}
                </select>
              </div>

              {selectedKeyword && (
                <>
                  {/* Subreddit list */}
                  <div>
                    <p className="form-label" style={{ marginBottom: 8 }}>
                      Watching ({(selectedKeyword.subreddits ?? []).length})
                    </p>
                    {(selectedKeyword.subreddits ?? []).length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        No subreddits yet for this keyword.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(selectedKeyword.subreddits ?? []).map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "7px 12px",
                              background: "var(--muted)",
                              borderRadius: "var(--radius)",
                              fontSize: 13,
                            }}
                          >
                            <span style={{ color: "var(--accent)", fontWeight: 500 }}>r/{sub.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSubreddit(sub.id)}
                              disabled={deletingId === sub.id}
                              style={{ padding: "2px 4px", color: "var(--muted-foreground)" }}
                            >
                              <Delete01Icon size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add subreddit */}
                  <div>
                    <p className="form-label" style={{ marginBottom: 8 }}>Add subreddit</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Input
                        placeholder="e.g. r/SaaS"
                        value={newSubreddit}
                        onChange={(e) => setNewSubreddit(e.target.value)}
                        disabled={adding}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubreddit(); } }}
                      />
                      <Button size="sm" onClick={addSubreddit} disabled={adding || !newSubreddit.trim()}>
                        <Add01Icon size={13} />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
