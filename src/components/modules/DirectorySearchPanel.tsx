import * as React from "react";
import {
  Search01Icon,
  Add01Icon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { toast } from "sonner";
import type {
  DirectoryKey,
  DirectoryResult,
} from "~/routes/api/directories/search";
import { DirectorySearchPanelProps, ResultState } from "./directories/types";
import { ResultCard } from "./directories/result-card";

const DIRECTORY_OPTIONS: { value: DirectoryKey; label: string }[] = [
  { value: "producthunt", label: "Product Hunt" },
  { value: "g2", label: "G2" },
  { value: "capterra", label: "Capterra" },
  { value: "indiehackers", label: "Indie Hackers" },
  { value: "betalist", label: "BetaList" },
  { value: "appsumo", label: "AppSumo" },
];

const RECENCY_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export function DirectorySearchPanel({ orgId }: DirectorySearchPanelProps) {
  const [directory, setDirectory] = React.useState<DirectoryKey>("producthunt");
  const [query, setQuery] = React.useState("");
  const [recency, setRecency] = React.useState("");
  const [results, setResults] = React.useState<ResultState[]>([]);
  const [directoryLabel, setDirectoryLabel] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [addingAll, setAddingAll] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);

  const savedCount = results.filter((r) => r.status === "saved").length;
  const idleResults = results.filter((r) => r.status === "idle");

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/directories/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          directory,
          query: query.trim(),
          recency: recency || undefined,
        }),
      });
      const data = (await res.json()) as {
        results?: DirectoryResult[];
        directoryLabel?: string;
        error?: string;
      };
      if (!res.ok || !data.results) {
        toast.error(data.error ? "Search failed" : "Search failed");
        return;
      }
      setResults(data.results.map((r) => ({ data: r, status: "idle" as const })));
      setDirectoryLabel(data.directoryLabel ?? directory);
      if (data.results.length === 0) {
        toast.info("No results found — try a broader query");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    const raw = results.map((r) => r.data);
    setEnriching(true);
    setResults((prev) => prev.map((r) => ({ ...r, status: "enriching" as const })));
    try {
      const res = await fetch("/api/directories/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: raw }),
      });
      const data = (await res.json()) as { results?: DirectoryResult[]; error?: string };
      if (!res.ok || !data.results) {
        setResults((prev) => prev.map((r) => ({ ...r, status: "idle" as const })));
        return;
      }
      setResults((prev) =>
        prev.map((r, i) => ({
          data: data.results![i] ?? r.data,
          status: "idle" as const,
        })),
      );
    } catch {
      setResults((prev) => prev.map((r) => ({ ...r, status: "idle" as const })));
    } finally {
      setEnriching(false);
    }
  }

  async function addResults(toAdd: ResultState[], indices: number[]) {
    if (toAdd.length === 0) return;

    // Mark as saving
    setResults((prev) =>
      prev.map((r, i) =>
        indices.includes(i) ? { ...r, status: "saving" } : r,
      ),
    );

    try {
      const res = await fetch("/api/directories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          directory,
          query,
          results: toAdd.map((r) => r.data),
        }),
      });
      const data = (await res.json()) as {
        saved?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Failed to add leads");
        setResults((prev) =>
          prev.map((r, i) =>
            indices.includes(i) ? { ...r, status: "idle" } : r,
          ),
        );
        return;
      }

      // Mark each as saved or duplicate based on position
      // Since the add endpoint processes in order, map saved/skipped back
      // Simplest: if saved > 0 treat all as saved (duplicates get skipped label)
      // More precise: re-check by trying individually — but that's wasteful.
      // We use the aggregate counts and mark accordingly.
      const savedArr: ("saved" | "duplicate")[] = [];
      let s = data.saved ?? 0;
      let sk = data.skipped ?? 0;
      for (let i = 0; i < toAdd.length; i++) {
        if (s > 0) {
          savedArr.push("saved");
          s--;
        } else if (sk > 0) {
          savedArr.push("duplicate");
          sk--;
        } else {
          savedArr.push("saved");
        }
      }

      setResults((prev) => {
        let idx = 0;
        return prev.map((r, i) => {
          if (!indices.includes(i)) return r;
          const status = savedArr[idx++] ?? "saved";
          return { ...r, status };
        });
      });

      const saved = data.saved ?? 0;
      const skipped = data.skipped ?? 0;
      if (saved > 0)
        toast.success(
          `${saved} lead${saved !== 1 ? "s" : ""} added to pipeline`,
        );
      if (skipped > 0) toast.info(`${skipped} already in pipeline`);
    } catch {
      toast.error("Network error");
      setResults((prev) =>
        prev.map((r, i) =>
          indices.includes(i) ? { ...r, status: "idle" } : r,
        ),
      );
    }
  }

  async function handleAddOne(index: number) {
    await addResults([results[index]], [index]);
  }

  async function handleAddAll() {
    setAddingAll(true);
    const idleIndices = results
      .map((r, i) => (r.status === "idle" ? i : -1))
      .filter((i) => i !== -1);
    const idleItems = idleIndices.map((i) => results[i]);
    await addResults(idleItems, idleIndices);
    setAddingAll(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input text-[13px]"
          value={directory}
          onChange={(e) => setDirectory(e.target.value as DirectoryKey)}
          style={{ maxWidth: 160 }}
        >
          {DIRECTORY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <input
          className="input text-[13px]"
          style={{ flex: 1, minWidth: 200 }}
          placeholder='Search query, e.g. "email automation SaaS"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />

        <select
          className="input text-[13px]"
          value={recency}
          onChange={(e) => setRecency(e.target.value)}
          style={{ maxWidth: 140 }}
        >
          {RECENCY_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? (
            <>
              <span className="spinner" />
              Searching...
            </>
          ) : (
            <>
              <Search01Icon size={13} />
              Find Companies
            </>
          )}
        </Button>
      </div>

      {/* Results header */}
      {results.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            {results.length} results from {directoryLabel} · {savedCount} added
            to pipeline
          </p>
          <div className="flex items-center gap-2">
            {results.length > 0 && !enriching && (
              <Button variant="ghost" onClick={handleEnrich}>
                Enrich
              </Button>
            )}
            {enriching && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="spinner" />
                Enriching...
              </span>
            )}
            {idleResults.length > 0 && (
              <Button variant="ghost" onClick={handleAddAll} disabled={addingAll}>
                <Add01Icon size={13} />
                {addingAll ? "Adding..." : `Add All (${idleResults.length})`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <EmptyState
          icon={<Search01Icon />}
          title="No results yet"
          description='Pick a directory, enter a search query, and hit "Find Companies" to pull real product listings.'
        />
      )}

      {/* Result cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map((r, i) => (
            <ResultCard key={i} result={r} onAdd={() => handleAddOne(i)} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
