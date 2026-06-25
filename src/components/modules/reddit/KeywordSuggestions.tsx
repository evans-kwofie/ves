import * as React from "react";
import { AiMagicIcon, Add01Icon, CheckmarkCircle01Icon, ArrowReloadHorizontalIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface Suggestion {
  keyword: string;
  subreddits: string[];
  reason: string;
}

interface KeywordSuggestionsProps {
  orgId: string;
  existingKeywords: Keyword[];
  onKeywordsChange: (keywords: Keyword[]) => void;
}

export function KeywordSuggestions({ orgId, existingKeywords, onKeywordsChange }: KeywordSuggestionsProps) {
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [addingAll, setAddingAll] = React.useState(false);
  const [added, setAdded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const unadded = suggestions.filter((s) => !added.has(s.keyword));
  const selectableKeys = unadded.map((s) => s.keyword);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));
  const someSelected = selectableKeys.some((k) => selected.has(k));
  const selectedCount = selectableKeys.filter((k) => selected.has(k)).length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableKeys));
    }
  }

  function toggleOne(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  async function generate() {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = (await res.json()) as { suggestions?: Suggestion[]; error?: string };
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        setAdded(new Set());
      } else {
        toast.error(data.error ?? "Failed to generate suggestions");
      }
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }

  async function addOne(suggestion: Suggestion): Promise<Keyword | null> {
    const res = await fetch("/api/keywords/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        keyword: suggestion.keyword,
        subreddits: suggestion.subreddits,
      }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<Keyword>;
  }

  async function handleAddOne(suggestion: Suggestion) {
    setAdding(suggestion.keyword);
    try {
      const kw = await addOne(suggestion);
      if (kw) {
        onKeywordsChange([...existingKeywords, kw]);
        setAdded((prev) => new Set([...prev, suggestion.keyword]));
        setSelected((prev) => { const n = new Set(prev); n.delete(suggestion.keyword); return n; });
        toast.success(`Added "${suggestion.keyword}"`);
      } else {
        toast.error("Failed to add keyword");
      }
    } catch {
      toast.error("Failed to add keyword");
    } finally {
      setAdding(null);
    }
  }

  async function handleAddSelected() {
    const toAdd = suggestions.filter((s) => selected.has(s.keyword) && !added.has(s.keyword));
    if (!toAdd.length) return;
    setAddingAll(true);
    try {
      const results = await Promise.all(toAdd.map(addOne));
      const succeeded = results.filter((k): k is Keyword => k !== null);
      const newAdded = new Set(added);
      succeeded.forEach((_, i) => { if (results[i]) newAdded.add(toAdd[i].keyword); });
      onKeywordsChange([...existingKeywords, ...succeeded]);
      setAdded(newAdded);
      setSelected(new Set());
      toast.success(`Added ${succeeded.length} keyword${succeeded.length !== 1 ? "s" : ""}`);
      if (succeeded.length < toAdd.length) toast.error(`${toAdd.length - succeeded.length} failed`);
    } catch {
      toast.error("Failed to add keywords");
    } finally {
      setAddingAll(false);
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold">Suggested keywords</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Based on your organisation profile. Select the ones you want to track.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 ${i < 5 ? "border-b border-border" : ""}`}
              >
                <div className="w-3.5 h-3.5 rounded bg-muted animate-pulse shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${90 + (i % 3) * 40}px` }} />
                    <div className="h-4 rounded-full bg-muted animate-pulse" style={{ width: `${50 + (i % 2) * 20}px` }} />
                    <div className="h-4 rounded-full bg-muted animate-pulse" style={{ width: `${40 + (i % 3) * 15}px` }} />
                  </div>
                  <div className="h-2.5 rounded bg-muted animate-pulse w-3/4" />
                </div>
                <div className="h-7 w-16 rounded-full bg-muted animate-pulse shrink-0" />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <AiMagicIcon size={18} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-semibold">No keywords yet</p>
                <p className="text-[12px] text-muted-foreground max-w-xs">
                  Get AI-powered keyword and subreddit recommendations based on your organisation profile.
                </p>
              </div>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-2 rounded-(--radius) text-[13px] font-semibold transition-all bg-accent text-accent-foreground hover:opacity-90"
              >
                Suggest keywords
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">Suggested keywords</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Based on your organisation profile. Select the ones you want to track.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <Button size="sm" onClick={handleAddSelected} disabled={addingAll}>
              <Add01Icon size={13} />
              {addingAll ? "Adding..." : `Add selected (${selectedCount})`}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={generate} disabled={loading}>
            <ArrowReloadHorizontalIcon size={13} className={loading ? "spinning" : ""} />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Select-all header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/40">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={toggleAll}
            className="w-3.5 h-3.5 accent-accent cursor-pointer"
          />
          <span className="text-[11px] text-muted-foreground font-medium">
            {someSelected ? `${selectedCount} selected` : "Select all"}
          </span>
        </div>

        {suggestions.map((s, i) => (
          <SuggestionRow
            key={s.keyword}
            suggestion={s}
            isAdded={added.has(s.keyword)}
            isAdding={adding === s.keyword}
            isSelected={selected.has(s.keyword)}
            onToggle={() => toggleOne(s.keyword)}
            onAdd={() => handleAddOne(s)}
            isLast={i === suggestions.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  isAdded,
  isAdding,
  isSelected,
  onToggle,
  onAdd,
  isLast,
}: {
  suggestion: Suggestion;
  isAdded: boolean;
  isAdding: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onAdd: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-3 transition-colors",
        !isLast ? "border-b border-border" : "",
        isAdded ? "bg-accent-subtle/30" : isSelected ? "bg-accent-subtle/20" : "hover:bg-muted/40",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={isAdded}
        className="w-3.5 h-3.5 accent-accent cursor-pointer shrink-0 disabled:cursor-default"
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold">{suggestion.keyword}</span>
          <div className="flex flex-wrap gap-1">
            {suggestion.subreddits.map((sub) => (
              <span
                key={sub}
                className="text-[10px] font-semibold text-accent bg-accent-subtle px-1.5 py-px rounded-full"
              >
                r/{sub}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{suggestion.reason}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={isAdded || isAdding}
        className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed whitespace-nowrap bg-accent-subtle text-accent hover:bg-accent hover:text-white disabled:opacity-60"
      >
        {isAdded ? (
          <>
            <CheckmarkCircle01Icon size={12} />
            Added
          </>
        ) : isAdding ? (
          "Adding..."
        ) : (
          <>
            <Add01Icon size={12} />
            Add
          </>
        )}
      </button>
    </div>
  );
}
