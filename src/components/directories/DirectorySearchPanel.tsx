import * as React from "react";
import {
  Search01Icon,
  ArrowDiagonalIcon,
  CheckmarkCircle01Icon,
  Add01Icon,
  FlashIcon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { DirectoryResult } from "~/routes/api/directories/search";

type DirectoryKey = "producthunt" | "g2" | "capterra" | "indiehackers" | "betalist" | "appsumo";

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

interface ResultState {
  data: DirectoryResult;
  status: "idle" | "saved" | "duplicate" | "saving";
}

interface DirectorySearchPanelProps {
  orgId: string;
}

export function DirectorySearchPanel({ orgId }: DirectorySearchPanelProps) {
  const [directory, setDirectory] = React.useState<DirectoryKey>("producthunt");
  const [query, setQuery] = React.useState("");
  const [recency, setRecency] = React.useState("");
  const [results, setResults] = React.useState<ResultState[]>([]);
  const [directoryLabel, setDirectoryLabel] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [addingAll, setAddingAll] = React.useState(false);

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
      const data = (await res.json()) as { results?: DirectoryResult[]; directoryLabel?: string; error?: string };
      if (!res.ok || !data.results) {
        toast.error(data.error ? "Search failed" : "Search failed");
        return;
      }
      setResults(data.results.map((r) => ({ data: r, status: "idle" })));
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

  async function addResults(toAdd: ResultState[], indices: number[]) {
    if (toAdd.length === 0) return;

    // Mark as saving
    setResults((prev) =>
      prev.map((r, i) => (indices.includes(i) ? { ...r, status: "saving" } : r))
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
      const data = (await res.json()) as { saved?: number; skipped?: number; error?: string };
      if (!res.ok) {
        toast.error("Failed to add leads");
        setResults((prev) =>
          prev.map((r, i) => (indices.includes(i) ? { ...r, status: "idle" } : r))
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
        if (s > 0) { savedArr.push("saved"); s--; }
        else if (sk > 0) { savedArr.push("duplicate"); sk--; }
        else { savedArr.push("saved"); }
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
      if (saved > 0) toast.success(`${saved} lead${saved !== 1 ? "s" : ""} added to pipeline`);
      if (skipped > 0) toast.info(`${skipped} already in pipeline`);
    } catch {
      toast.error("Network error");
      setResults((prev) =>
        prev.map((r, i) => (indices.includes(i) ? { ...r, status: "idle" } : r))
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
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <input
          className="input text-[13px]"
          style={{ flex: 1, minWidth: 200 }}
          placeholder='Search query, e.g. "email automation SaaS"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
        />

        <select
          className="input text-[13px]"
          value={recency}
          onChange={(e) => setRecency(e.target.value)}
          style={{ maxWidth: 140 }}
        >
          {RECENCY_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? (
            <><span className="spinner" />Searching...</>
          ) : (
            <><Search01Icon size={13} />Find Companies</>
          )}
        </Button>
      </div>

      {/* Results header */}
      {results.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            {results.length} results from {directoryLabel} · {savedCount} added to pipeline
          </p>
          {idleResults.length > 0 && (
            <Button variant="ghost" onClick={handleAddAll} disabled={addingAll}>
              <FlashIcon size={13} />
              {addingAll ? "Adding..." : `Add All (${idleResults.length})`}
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">No results yet</p>
          <p className="text-[12px] text-[var(--muted-foreground)] max-w-xs">
            Pick a directory, enter a search query, and hit "Find Companies" — Claude will scan the directory and pull real product listings with founder details.
          </p>
        </div>
      )}

      {/* Result cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map((r, i) => (
            <ResultCard
              key={i}
              result={r}
              onAdd={() => handleAddOne(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, onAdd }: { result: ResultState; onAdd: () => void }) {
  const { data, status } = result;
  const linkedinUrl = data.linkedinHint
    ? data.linkedinHint.startsWith("http")
      ? data.linkedinHint
      : `https://linkedin.com/in/${data.linkedinHint}`
    : null;

  return (
    <div className="card p-4 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--foreground)] truncate">{data.company}</p>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {data.founderName ?? <span style={{ fontStyle: "italic" }}>Founder not found</span>}
          </p>
        </div>
        <div className="shrink-0">
          {status === "saved" && (
            <CheckmarkCircle01Icon size={16} className="text-[var(--accent)]" />
          )}
          {status === "duplicate" && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              Duplicate
            </span>
          )}
          {status === "saving" && <span className="spinner" />}
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-[var(--muted-foreground)] leading-snug line-clamp-2">
        {data.whatTheyDo}
      </p>

      {/* Email */}
      <div style={{ fontSize: 11, color: data.email ? "var(--foreground)" : "var(--muted-foreground)", fontStyle: data.email ? "normal" : "italic" }}>
        {data.email ? data.email : "No email found"}
      </div>

      {/* Launch date */}
      {data.launchedAt && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Launched {data.launchedAt}
        </div>
      )}

      {/* Links + action */}
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {data.website && (
          <a
            href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            <ArrowDiagonalIcon size={10} />
            Website
          </a>
        )}
        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            <ArrowDiagonalIcon size={10} />
            LinkedIn
          </a>
        )}
        {data.directoryUrl && (
          <a
            href={data.directoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            <ArrowDiagonalIcon size={10} />
            Listing
          </a>
        )}
        {status === "idle" && (
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onAdd}>
            <Add01Icon size={11} />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
