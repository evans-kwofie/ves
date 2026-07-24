import * as React from "react";
import {
  ArrowReloadHorizontalIcon,
  BubbleChatIcon,
  FilterIcon,
  Delete02Icon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { ReplyCard } from "../molecules/ReplyCard";
import { toast } from "sonner";
import type { RedditPost, IntentType } from "~/types/reddit";
import { Route } from "~/routes/$workspaceId/reddit";
import type { ScanEvent } from "~/routes/api/reddit/search";

type SortKey = "score" | "intentScore" | "newest";

const INTENT_FILTERS: { label: string; value: IntentType | null }[] = [
  { label: "All", value: null },
  { label: "Buying", value: "buying" },
  { label: "Pain point", value: "pain" },
  { label: "Discussion", value: "discussion" },
  { label: "Noise", value: "noise" },
];

const SORT_LABEL: Record<SortKey, string> = {
  score: "Top posts",
  intentScore: "Intent score",
  newest: "Newest first",
};

interface RedditFeedProps {
  orgId: string;
  posts: RedditPost[];
  selectedKeywordId: string | null | undefined;
  onPostsUpdated: (posts: RedditPost[]) => void;
}

const SCAN_TOAST_ID = "reddit-scan";

export function RedditFeed({
  orgId,
  posts,
  selectedKeywordId,
  onPostsUpdated,
}: RedditFeedProps) {
  const searchParams = Route.useSearch();
  const navigator = Route.useNavigate();
  const [refreshing, setRefreshing] = React.useState(false);
  const [clearState, setClearState] = React.useState<"idle" | "confirm" | "clearing">("idle");

  const intentFilter = searchParams.intent ?? null;
  const sortBy = searchParams.sort ?? "score";

  const stats = React.useMemo(
    () => ({
      buying: posts.filter((p) => p.intentType === "buying").length,
      pain: posts.filter((p) => p.intentType === "pain").length,
      discussion: posts.filter((p) => p.intentType === "discussion").length,
      noise: posts.filter((p) => p.intentType === "noise").length,
      total: posts.length,
    }),
    [posts],
  );

  const displayed = React.useMemo(() => {
    const filtered = intentFilter
      ? posts.filter((p) => p.intentType === intentFilter)
      : posts;
    return [...filtered].sort((a, b) => {
      if (sortBy === "intentScore")
        return (b.intentScore ?? 0) - (a.intentScore ?? 0);
      if (sortBy === "newest")
        return (
          new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
        );
      return b.score - a.score;
    });
  }, [posts, intentFilter, sortBy]);

  async function refreshFeed() {
    setRefreshing(true);
    toast.loading("Starting scan...", { id: SCAN_TOAST_ID });

    try {
      const body = selectedKeywordId
        ? { organizationId: orgId, keywordId: selectedKeywordId }
        : { organizationId: orgId };

      const res = await fetch("/api/reddit/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as ScanEvent;
            if (event.type === "fetch") {
              toast.loading(`Scanning r/${event.subreddit}...`, {
                id: SCAN_TOAST_ID,
              });
            } else if (event.type === "classify") {
              toast.loading("Classifying posts...", { id: SCAN_TOAST_ID });
            } else if (event.type === "lead") {
              toast.loading(`Lead found · u/${event.author}`, {
                id: SCAN_TOAST_ID,
              });
            } else if (event.type === "done") {
              const leadMsg = event.leadsCreated
                ? ` · ${event.leadsCreated} lead${event.leadsCreated !== 1 ? "s" : ""}`
                : "";
              toast.success(`Fetched ${event.totalSaved} posts${leadMsg}`, {
                id: SCAN_TOAST_ID,
              });
              const postsUrl = selectedKeywordId
                ? `/api/reddit/posts?organizationId=${orgId}&keywordId=${selectedKeywordId}`
                : `/api/reddit/posts?organizationId=${orgId}`;
              const postsRes = await fetch(postsUrl);
              onPostsUpdated((await postsRes.json()) as RedditPost[]);
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      console.error("[reddit:refresh] error:", err);
      toast.error("Failed to refresh feed", { id: SCAN_TOAST_ID });
    } finally {
      setRefreshing(false);
    }
  }

  function handleSuggestionSaved(postId: string, suggestion: string) {
    onPostsUpdated(posts.map((p) => (p.id === postId ? { ...p, replySuggestion: suggestion } : p)));
  }

  function handleDismiss(postId: string) {
    onPostsUpdated(posts.filter((p) => p.id !== postId));
  }

  async function clearAll() {
    if (clearState === "idle") {
      setClearState("confirm");
      setTimeout(() => setClearState((s) => (s === "confirm" ? "idle" : s)), 3000);
      return;
    }
    if (clearState !== "confirm") return;
    setClearState("clearing");
    try {
      const body: Record<string, string> = { organizationId: orgId };
      if (selectedKeywordId) body.keywordId = selectedKeywordId;
      const res = await fetch("/api/reddit/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onPostsUpdated([]);
        toast.success("Posts cleared");
      } else {
        toast.error("Failed to clear posts");
      }
    } catch {
      toast.error("Failed to clear posts");
    } finally {
      setClearState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Intent summary strip */}
      {stats.total > 0 && (
        <div className="flex gap-4 py-2.5 px-3.5 bg-muted rounded flex-wrap text-[12px]">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{stats.total}</strong> posts
          </span>
          {stats.buying > 0 && (
            <span className="text-accent">
              <strong>{stats.buying}</strong> buying signal
              {stats.buying !== 1 ? "s" : ""}
            </span>
          )}
          {stats.pain > 0 && (
            <span className="text-amber-400">
              <strong>{stats.pain}</strong> pain point
              {stats.pain !== 1 ? "s" : ""}
            </span>
          )}
          {stats.discussion > 0 && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">{stats.discussion}</strong>{" "}
              discussion{stats.discussion !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Filters + refresh */}
      <div className="flex items-center gap-2 justify-end">
        <Select
          value={sortBy}
          onValueChange={(val) =>
            navigator({ search: (prev) => ({ ...prev, sort: val as SortKey }) })
          }
        >
          <SelectTrigger>
            <span className="text-muted-foreground">Sort:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SORT_LABEL) as [SortKey, string][]).map(
              ([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select
          value={intentFilter ?? ""}
          onValueChange={(val) =>
            navigator({ search: (prev) => ({ ...prev, intent: val as any }) })
          }
        >
          <SelectTrigger>
            <span className="text-muted-foreground">Intent:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTENT_FILTERS.map((f) => {
              const count = f.value ? stats[f.value] : stats.total;
              return (
                <SelectItem key={String(f.value)} value={f.value ?? ""}>
                  {f.label}
                  {count > 0 ? ` (${count})` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {posts.length > 0 && (
          <Button
            variant="ghost"
            size="default"
            onClick={clearAll}
            disabled={clearState === "clearing"}
            className={clearState === "confirm" ? "text-destructive hover:text-destructive" : ""}
          >
            <Delete02Icon size={13} />
            {clearState === "confirm" ? "Confirm clear" : clearState === "clearing" ? "Clearing..." : "Clear"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="default"
          onClick={refreshFeed}
          disabled={refreshing}
        >
          <ArrowReloadHorizontalIcon
            size={13}
            className={refreshing ? "spinning" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Post list */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={posts.length === 0 ? <BubbleChatIcon /> : <FilterIcon />}
          title={posts.length === 0 ? "No posts yet" : "Nothing matches this filter"}
          description={
            posts.length === 0
              ? "Hit Refresh to pull in the latest posts from your subreddits."
              : "Try a different intent type or sort order."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((post) => (
            <ReplyCard
              key={post.id}
              orgId={orgId}
              post={post}
              onSuggestionSaved={handleSuggestionSaved}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
