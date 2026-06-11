import * as React from "react";
import { ArrowReloadHorizontalIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { ReplyCard } from "../molecules/ReplyCard";
import { toast } from "sonner";
import type { RedditPost, IntentType } from "~/types/reddit";
import type { Keyword } from "~/types/keyword";
import { Route } from "~/routes/$workspaceId/reddit";

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
  onPostsUpdated: (posts: RedditPost[]) => void;
}

export function RedditFeed({
  orgId,
  posts,
  keywords,

  onPostsUpdated,
}: RedditFeedProps) {
  const searchParams = Route.useSearch()
  const navigator = Route.useNavigate()

  const [refreshing, setRefreshing] = React.useState(false);

  console.log('search params', searchParams)

  const intentFilter = searchParams.intent ?? null;
  const sortBy = searchParams.sort ?? "score";
  const selectedKeywordId = searchParams?.keyword === '' ? null : searchParams?.keyword

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
          className="flex mb-4 gap-4 py-2.5 px-3.5 bg-(--muted) border-(--radius) flex-wrap"
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
            onClick={() => {
              navigator({
                search: (prev) => ({
                  ...prev,
                  keyword: '' as any
                })
              })
            }}
          >
            All keywords
          </button>
          {keywords.map((k) => (
            <button
              key={k.id}
              className="tab-trigger"
              data-state={selectedKeywordId === k.id ? "active" : "inactive"}
              onClick={() => {
                navigator({
                  search: (prev) => ({
                    ...prev,
                    keyword: k.id
                  })
                })
              }}
            >
              {k.keyword}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div>
            <select
              className="input"
              style={{ fontSize: 12, padding: "4px 8px", height: "auto" }}
              value={sortBy}
              onChange={(e) => {

                navigator({
                  search: (prev) => ({
                    ...prev,
                    sort: e.target.value as any
                  })
                })
              }}
            >
              {(Object.entries(SORT_LABEL) as [SortKey, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {/* Intent filter dropdown */}
          <div >
            <select
              value={intentFilter ?? ""}
              onChange={(e) => {

                navigator({
                  search: (prev) => ({
                    ...prev,
                    intent: e.target.value as any
                  })
                })
              }}
              className="input"
              style={{ fontSize: 12, padding: "4px 8px", height: "auto" }}
            >
              {INTENT_FILTERS.map((f) => {
                const count = f.value ? stats[f.value] : stats.total;

                return (
                  <option key={String(f.value)} value={f.value ?? ""}>
                    {f.label}
                    {count > 0 ? ` (${count})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={refreshing}>
            <ArrowReloadHorizontalIcon size={13} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>


      {/* Post list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <p className="text-[13px] font-semibold text-(--foreground)">No results yet</p>
          <p className="text-[12px] text-(--muted-foreground) max-w-xs">
            {posts.length === 0
              ? "No posts yet. Add subreddits to your keywords and click Refresh."
              : "No posts match this filter."}
          </p>
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
