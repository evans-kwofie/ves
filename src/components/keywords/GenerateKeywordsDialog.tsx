import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { AiMagicIcon } from "hugeicons-react";
import { AiBrain02Icon } from "hugeicons-react";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface Suggestion {
  keyword: string;
  subreddits: string[];
  reason: string;
}

interface GenerateKeywordsDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (keywords: Keyword[]) => void;
}

export function GenerateKeywordsDialog({
  orgId,
  open,
  onOpenChange,
  onSuccess,
}: GenerateKeywordsDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  // Generate on open
  React.useEffect(() => {
    if (!open) return;
    setSuggestions([]);
    setSelected(new Set());
    setFailed(false);
    generate();
  }, [open]);

  async function generate() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = (await res.json()) as { suggestions?: Suggestion[]; error?: string };
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setSelected(new Set(data.suggestions.map((_, i) => i)));
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function handleAdd() {
    const toAdd = suggestions.filter((_, i) => selected.has(i));
    if (toAdd.length === 0) return;

    setAdding(true);
    const created: Keyword[] = [];

    for (const s of toAdd) {
      try {
        const res = await fetch("/api/keywords/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            keyword: s.keyword,
            subreddits: s.subreddits,
          }),
        });
        if (res.ok) {
          const kw = (await res.json()) as Keyword;
          created.push(kw);
        }
      } catch {}
    }

    setAdding(false);
    if (created.length > 0) {
      onSuccess(created);
      toast.success(`Added ${created.length} keyword${created.length !== 1 ? "s" : ""}`);
      onOpenChange(false);
    } else {
      toast.error("No keywords were added");
    }
  }

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AiMagicIcon size={15} style={{ color: "var(--accent)" }} />
            Generate keywords
          </DialogTitle>
          <DialogDescription>
            AI-suggested keywords based on your workspace context. Select the ones you want to add.
          </DialogDescription>
        </DialogHeader>

        <div style={{ minHeight: 120 }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "32px 0",
                color: "var(--muted-foreground)",
                fontSize: 13,
              }}
            >
              <span className="spinner" style={{ width: 18, height: 18 }} />
              Analysing your workspace and generating suggestions…
            </div>
          ) : failed ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: "36px 0",
                textAlign: "center",
              }}
            >
              <AiBrain02Icon
                size={44}
                primaryColor="var(--muted-foreground)"
                secondaryColor="var(--accent)"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  Couldn't generate suggestions
                </p>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", maxWidth: 300 }}>
                  This usually means your workspace description is empty. Add some context in{" "}
                  <a
                    href="settings/workspace"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    Settings → Workspace
                  </a>{" "}
                  and try again.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {suggestions.map((s, i) => {
                const isSelected = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSelect(i)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "10px 12px",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      background: isSelected ? "var(--accent-subtle)" : "var(--card)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSelected ? "var(--accent)" : "var(--foreground)",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {s.keyword}
                      </span>
                      {s.subreddits.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                          r/{s.subreddits.join(", r/")}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                      {s.reason}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!loading && suggestions.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selectedCount === suggestions.length
                    ? new Set()
                    : new Set(suggestions.map((_, i) => i)),
                )
              }
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {selectedCount === suggestions.length ? "Deselect all" : "Select all"}
            </button>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {selectedCount} of {suggestions.length} selected
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={adding}>
            Cancel
          </Button>
          {!loading && (suggestions.length > 0 || failed) && (
            <Button variant="ghost" onClick={generate} disabled={adding}>
              Regenerate
            </Button>
          )}
          {!failed && (
            <Button onClick={handleAdd} disabled={adding || selectedCount === 0 || loading}>
              {adding ? "Adding…" : `Add ${selectedCount > 0 ? selectedCount : ""} keyword${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
