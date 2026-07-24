import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { FlashIcon, AiBrain02Icon, CheckmarkCircle01Icon } from "hugeicons-react";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:min-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FlashIcon size={15} style={{ color: "var(--accent)" }} />
            Generate keywords
          </SheetTitle>
          <SheetDescription>
            AI-suggested keywords based on your workspace context. Select the ones you want to add.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <span className="spinner" style={{ width: 18, height: 18 }} />
              <p className="text-[13px]">Analysing your workspace and generating suggestions…</p>
            </div>
          ) : failed ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <AiBrain02Icon
                size={44}
                primaryColor="var(--muted-foreground)"
                secondaryColor="var(--accent)"
              />
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] font-semibold">Couldn't generate suggestions</p>
                <p className="text-[12px] text-muted-foreground max-w-65">
                  This usually means your workspace description is empty. Add some context in{" "}
                  <a href="settings/workspace" className="text-accent no-underline">
                    Settings → Workspace
                  </a>{" "}
                  and try again.
                </p>
              </div>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Select-all bar */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selectedCount === suggestions.length
                        ? new Set()
                        : new Set(suggestions.map((_, i) => i)),
                    )
                  }
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
                >
                  {selectedCount === suggestions.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-[12px] text-muted-foreground">
                  {selectedCount} of {suggestions.length} selected
                </span>
              </div>

              {/* Suggestion list */}
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => {
                  const isSelected = selected.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleSelect(i)}
                      className="flex flex-col gap-1.5 p-3 rounded-(--radius) text-left transition-colors cursor-pointer border border-border card-enter"
                      style={{
                        "--card-i": i,
                        background: isSelected ? "var(--muted)" : "var(--card)",
                        opacity: isSelected ? 1 : 0.75,
                      } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold font-mono text-foreground">
                          {s.keyword}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.subreddits.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              r/{s.subreddits.join(", r/")}
                            </span>
                          )}
                          {isSelected && (
                            <CheckmarkCircle01Icon size={14} className="text-accent shrink-0" />
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground leading-relaxed">
                        {s.reason}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter>
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
              {adding
                ? "Adding…"
                : `Add ${selectedCount > 0 ? selectedCount : ""} keyword${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
