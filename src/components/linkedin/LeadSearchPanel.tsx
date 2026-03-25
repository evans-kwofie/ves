import * as React from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import type { LinkedInLeadResult } from "~/types/linkedin";
import type { Keyword } from "~/types/keyword";
import type { Lead } from "~/types/lead";

interface LeadSearchPanelProps {
  keywords: Keyword[];
}

export function LeadSearchPanel({ keywords }: LeadSearchPanelProps) {
  const [keyword, setKeyword] = React.useState(keywords[0]?.keyword ?? "");
  const [results, setResults] = React.useState<LinkedInLeadResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [addingIndex, setAddingIndex] = React.useState<number | null>(null);
  const [addedIndices, setAddedIndices] = React.useState<Set<number>>(new Set());

  async function search() {
    if (!keyword.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/linkedin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = (await res.json()) as { results?: LinkedInLeadResult[]; error?: string };
      setResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        toast.info("No results found");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function addToPipeline(result: LinkedInLeadResult, index: number) {
    setAddingIndex(index);
    try {
      const res = await fetch("/api/pipeline/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: result.company,
          website: result.website,
          whatTheyDo: result.whatTheyDo,
          ceo: result.name,
          email: `${result.name.split(" ")[0]?.toLowerCase()}@${result.website.replace(/^https?:\/\//, "").split("/")[0]}`,
          linkedin: result.linkedinUrl,
          fit: "HIGH",
          notes: `Found via LinkedIn search: ${keyword}`,
        }),
      });
      if (res.ok) {
        setAddedIndices((prev) => new Set([...prev, index]));
        toast.success(`${result.company} added to pipeline`);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to add lead");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAddingIndex(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {keywords.length > 0 ? (
          <select
            className="input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ maxWidth: 240 }}
          >
            {keywords.map((k) => (
              <option key={k.id} value={k.keyword}>
                {k.keyword}
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Enter keyword..."
            style={{ maxWidth: 240 }}
          />
        )}
        <Button onClick={search} disabled={loading || !keyword.trim()}>
          {loading ? (
            <>
              <span className="spinner" />
              Searching...
            </>
          ) : (
            <>
              <Search size={14} />
              Find Leads
            </>
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((result, i) => (
            <div key={i} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{result.company}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {result.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {result.whatTheyDo}
                </div>
                {result.linkedinUrl && (
                  <a
                    href={result.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, display: "block" }}
                  >
                    LinkedIn →
                  </a>
                )}
              </div>
              {addedIndices.has(i) ? (
                <Badge variant="green">Added</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => addToPipeline(result, i)}
                  disabled={addingIndex === i}
                >
                  <UserPlus size={13} />
                  Add
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
