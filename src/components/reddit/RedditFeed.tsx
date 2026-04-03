import * as React from "react";
import { ArrowReloadHorizontalIcon, MessageSearch01Icon, SortingAZ01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { ReplyCard } from "./ReplyCard";
import { toast } from "sonner";
import type { RedditPost, IntentType } from "~/types/reddit";
import type { Keyword } from "~/types/keyword";

type SortKey = "score" | "intentScore" | "newest";

const INTENT_FILTERS: { label: string; value: IntentType | null }[] = [
  { label: "All", value: null },
  { label: "Buying", value: "buying" },
  { label: "Pain point", value: "pain" },
  { label: "Discussion", value: "discussion" },
  { label: "Noise", value: "noise" },
];

const INTENT_COLOR: Record<IntentType, string> = {
  buying: "var(--accent)",
  pain: "#f59e0b",
  discussion: "var(--muted-foreground)",
  noise: "var(--muted-foreground)",
};

interface RedditFeedProps {
  orgId: string;
  posts: RedditPost[];
  keywords: Keyword[];
  selectedKeywordId: string | null;
  onSelectKeyword: (id: string | null) => void;
  onPostsUpdated: (posts: RedditPost[]) => void;
}

export function RedditFeed({
  orgId,
  posts,
  keywords,
  selectedKeywordId,
  onSelectKeyword,
  onPostsUpdated,
}: RedditFeedProps) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [intentFilter, setIntentFilter] = React.useState<IntentType | null>(null);
  const [sortBy, setSortBy] = React.useState<SortKey>("score");

  // Intent stats from the current keyword-filtered posts
  const stats = React.useMemo(() => ({
    buying: posts.filter((p) => p.intentType === "buying").length,
    pain: posts.filter((p) => p.intentType === "pain").length,
    discussion: posts.filter((p) => p.intentType === "discussion").length,
    noise: posts.filter((p) => p.intentType === "noise").length,
    total: posts.length,
  }), [posts]);

  // Apply intent filter then sort
  const displayed = React.useMemo(() => {
    const filtered = intentFilter
      ? posts.filter((p) => p.intentType === intentFilter)
      : posts;

    return [...filtered].sort((a, b) => {
      if (sortBy === "intentScore") return (b.intentScore ?? 0) - (a.intentScore ?? 0);
      if (sortBy === "newest") return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime();
      return b.score - a.score; // "score" = upvotes, default
    });
  }, [posts, intentFilter, sortBy]);

  async function refreshFeed() {
    setRefreshing(true);
    try {
      const body = selectedKeywordId
        ? { organizationId: orgId, keywordId: selectedKeywordId }
        : { organizationId: orgId };
      const res = await fetch("/api/reddit/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { totalSaved?: number; leadsCreated?: number; error?: string };
      if (data.totalSaved !== undefined) {
        const leadMsg = data.leadsCreated ? ` · ${data.leadsCreated} lead${data.leadsCreated !== 1 ? "s" : ""} created` : "";
        toast.success(`Fetched ${data.totalSaved} posts${leadMsg}`);
      }

      const postsUrl = selectedKeywordId
        ? `/api/reddit/posts?organizationId=${orgId}&keywordId=${selectedKeywordId}`
        : `/api/reddit/posts?organizationId=${orgId}`;
      const postsRes = await fetch(postsUrl);
      const updated = (await postsRes.json()) as RedditPost[];
      onPostsUpdated(updated);
    } catch {
      toast.error("Failed to refresh feed");
    } finally {
      setRefreshing(false);
    }
  }

  function handleSuggestionSaved(postId: string, suggestion: string) {
    onPostsUpdated(
      posts.map((p) => (p.id === postId ? { ...p, replySuggestion: suggestion } : p)),
    );
  }

  const SORT_LABEL: Record<SortKey, string> = {
    score: "Top posts",
    intentScore: "Intent score",
    newest: "Newest first",
  };

  return (
    <div>
      {/* Intent summary strip */}
      {stats.total > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            padding: "10px 14px",
            background: "var(--muted)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--muted-foreground)" }}>
            <strong style={{ color: "var(--foreground)" }}>{stats.total}</strong> posts
          </span>
          {stats.buying > 0 && (
            <span style={{ color: INTENT_COLOR.buying }}>
              <strong>{stats.buying}</strong> buying signal{stats.buying !== 1 ? "s" : ""}
            </span>
          )}
          {stats.pain > 0 && (
            <span style={{ color: INTENT_COLOR.pain }}>
              <strong>{stats.pain}</strong> pain point{stats.pain !== 1 ? "s" : ""}
            </span>
          )}
          {stats.discussion > 0 && (
            <span style={{ color: "var(--muted-foreground)" }}>
              <strong style={{ color: "var(--foreground)" }}>{stats.discussion}</strong> discussion{stats.discussion !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Keyword filter + sort + refresh */}
      <div className="section-row" style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className="tab-trigger"
            data-state={selectedKeywordId === null ? "active" : "inactive"}
            onClick={() => onSelectKeyword(null)}
          >
            All keywords
          </button>
          {keywords.map((k) => (
            <button
              key={k.id}
              className="tab-trigger"
              data-state={selectedKeywordId === k.id ? "active" : "inactive"}
              onClick={() => onSelectKeyword(k.id)}
            >
              {k.keyword}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SortingAZ01Icon size={13} style={{ color: "var(--muted-foreground)" }} />
            <select
              className="input"
              style={{ fontSize: 12, padding: "4px 8px", height: "auto" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              {(Object.entries(SORT_LABEL) as [SortKey, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={refreshing}>
            <ArrowReloadHorizontalIcon size={13} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Intent filter row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {INTENT_FILTERS.map((f) => {
          const active = intentFilter === f.value;
          const count = f.value ? stats[f.value] : stats.total;
          return (
            <button
              key={String(f.value)}
              onClick={() => setIntentFilter(f.value)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                border: active
                  ? `1px solid ${f.value ? INTENT_COLOR[f.value] : "var(--accent)"}`
                  : "1px solid var(--border)",
                background: active ? "var(--muted)" : "transparent",
                color: active
                  ? f.value ? INTENT_COLOR[f.value] : "var(--foreground)"
                  : "var(--muted-foreground)",
                transition: "all 0.15s",
              }}
            >
              {f.label}
              {count > 0 && (
                <span style={{ marginLeft: 5, opacity: 0.7 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Post list */}
      {displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MessageSearch01Icon size={32} />
          </div>
          <div>
            {posts.length === 0
              ? "No posts yet. Add subreddits to your keywords and click Refresh."
              : "No posts match this filter."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {displayed.map((post) => (
            <ReplyCard
              key={post.id}
              orgId={orgId}
              post={post}
              onSuggestionSaved={handleSuggestionSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
