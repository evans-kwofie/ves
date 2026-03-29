import * as React from "react";
import { Search01Icon, FlashIcon, ArrowDiagonalIcon, CheckmarkCircle01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface LeadResult {
  company: string;
  name: string;
  whatTheyDo: string;
  website: string;
  linkedinHint: string;
  keyword: string;
  saved: boolean;
}

interface LeadSearchPanelProps {
  orgId: string;
  keywords: Keyword[];
}

export function LeadSearchPanel({ orgId, keywords }: LeadSearchPanelProps) {
  const [selectedKeywordId, setSelectedKeywordId] = React.useState(keywords[0]?.id ?? "");
  const [results, setResults] = React.useState<LeadResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<"single" | "all">("single");

  const selectedKeyword = keywords.find((k) => k.id === selectedKeywordId);

  async function run(runAll: boolean) {
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/linkedin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keyword: runAll ? undefined : selectedKeyword?.keyword,
          runAll,
        }),
      });
      const data = (await res.json()) as { results?: LeadResult[]; totalSaved?: number; error?: string };
      if (data.results) {
        setResults(data.results);
        const saved = data.totalSaved ?? 0;
        if (saved > 0) {
          toast.success(`${saved} lead${saved !== 1 ? "s" : ""} added to pipeline`);
        } else {
          toast.info("No new leads found — they may already be in your pipeline");
        }
      } else {
        toast.error(data.error ?? "Search failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-[var(--radius)] border border-[var(--border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${mode === "single" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            Single keyword
          </button>
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${mode === "all" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            All keywords
          </button>
        </div>

        {mode === "single" && (
          <select
            className="input text-[13px]"
            value={selectedKeywordId}
            onChange={(e) => setSelectedKeywordId(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {keywords.length === 0 && <option value="">No keywords yet</option>}
            {keywords.map((k) => (
              <option key={k.id} value={k.id}>{k.keyword}</option>
            ))}
          </select>
        )}

        {mode === "all" && (
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Will search across all {keywords.filter((k) => k.isActive).length} active keywords
          </p>
        )}

        <Button
          onClick={() => run(mode === "all")}
          disabled={loading || (mode === "single" && !selectedKeyword)}
          className="ml-auto"
        >
          {loading ? (
            <><span className="spinner" />Searching...</>
          ) : mode === "all" ? (
            <><FlashIcon size={13} />Run all keywords</>
          ) : (
            <><Search01Icon size={13} />Find leads</>
          )}
        </Button>
      </div>

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">No results yet</p>
          <p className="text-[12px] text-[var(--muted-foreground)] max-w-xs">
            Pick a keyword and hit "Find leads" — Claude will search for real companies and founders to add to your pipeline.
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
            {results.length} results · {results.filter((r) => r.saved).length} added to pipeline
          </p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((r, i) => (
              <div key={i} className="card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">{r.company}</p>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{r.name}</p>
                  </div>
                  {r.saved ? (
                    <CheckmarkCircle01Icon size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full shrink-0">
                      Duplicate
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--muted-foreground)] leading-snug">{r.whatTheyDo}</p>
                <div className="flex items-center gap-3 mt-1">
                  {r.website && (
                    <a
                      href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
                    >
                      <ArrowDiagonalIcon size={10} />
                      Website
                    </a>
                  )}
                  {r.linkedinHint && (
                    <a
                      href={`https://linkedin.com/in/${r.linkedinHint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
                    >
                      <ArrowDiagonalIcon size={10} />
                      LinkedIn
                    </a>
                  )}
                  <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">via: {r.keyword}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
