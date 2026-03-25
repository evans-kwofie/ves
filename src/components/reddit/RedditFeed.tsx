import * as React from "react";
import { RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ReplyCard } from "./ReplyCard";
import { toast } from "sonner";
import type { RedditPost } from "~/types/reddit";
import type { Keyword } from "~/types/keyword";

interface RedditFeedProps {
  posts: RedditPost[];
  keywords: Keyword[];
  selectedKeywordId: string | null;
  onSelectKeyword: (id: string | null) => void;
  onPostsUpdated: (posts: RedditPost[]) => void;
}

export function RedditFeed({
  posts,
  keywords,
  selectedKeywordId,
  onSelectKeyword,
  onPostsUpdated,
}: RedditFeedProps) {
  const [refreshing, setRefreshing] = React.useState(false);

  async function refreshFeed() {
    setRefreshing(true);
    try {
      const body = selectedKeywordId ? { keywordId: selectedKeywordId } : {};
      const res = await fetch("/api/reddit/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { totalSaved?: number; error?: string };
      if (data.totalSaved !== undefined) {
        toast.success(`Fetched ${data.totalSaved} posts`);
      }

      // Reload posts
      const postsUrl = selectedKeywordId
        ? `/api/reddit/posts?keywordId=${selectedKeywordId}`
        : "/api/reddit/posts";
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

  return (
    <div>
      <div className="section-row" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className={`tab-trigger${selectedKeywordId === null ? ' active' : ''}`}
            data-state={selectedKeywordId === null ? "active" : "inactive"}
            onClick={() => onSelectKeyword(null)}
          >
            All
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
        <Button variant="ghost" size="sm" onClick={refreshFeed} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? "spinning" : ""} />
          {refreshing ? "Refreshing..." : "Refresh Feed"}
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MessageSquare size={32} />
          </div>
          <div>No posts yet. Add subreddits to your keywords and click Refresh.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((post) => (
            <ReplyCard key={post.id} post={post} onSuggestionSaved={handleSuggestionSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
