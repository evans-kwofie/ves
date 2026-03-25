import * as React from "react";
import { ExternalLink, Copy, Sparkles, ArrowUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { RedditPost } from "~/types/reddit";

interface ReplyCardProps {
  post: RedditPost;
  onSuggestionSaved: (postId: string, suggestion: string) => void;
}

export function ReplyCard({ post, onSuggestionSaved }: ReplyCardProps) {
  const [generating, setGenerating] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(post.replySuggestion ?? "");

  async function generateReply() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reddit/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          title: post.title,
          body: post.body,
          subreddit: post.subreddit,
        }),
      });
      const data = (await res.json()) as { suggestion?: string; error?: string };
      if (data.suggestion) {
        setSuggestion(data.suggestion);
        onSuggestionSaved(post.id, data.suggestion);
        toast.success("Reply suggestion generated");
      }
    } catch {
      toast.error("Failed to generate reply");
    } finally {
      setGenerating(false);
    }
  }

  function copyReply() {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion).then(() => toast.success("Copied!"));
    }
  }

  return (
    <div className="reddit-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="reddit-card-title"
          style={{ textDecoration: "none", flex: 1 }}
        >
          {post.title}
        </a>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--muted-foreground)", flexShrink: 0 }}
        >
          <ExternalLink size={13} />
        </a>
      </div>

      <div className="reddit-card-meta">
        <span style={{ color: "var(--accent)" }}>r/{post.subreddit}</span>
        <span>u/{post.author}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <ArrowUp size={11} />
          {post.score}
        </span>
        <span>{new Date(post.fetchedAt).toLocaleDateString()}</span>
      </div>

      {post.body && <p className="reddit-card-body">{post.body}</p>}

      {suggestion ? (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            Suggested Reply
          </div>
          <div className="reddit-card-reply">{suggestion}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Button variant="ghost" size="sm" onClick={copyReply}>
              <Copy size={12} />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
              <Sparkles size={12} />
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
          {generating ? (
            <>
              <span className="spinner" style={{ width: 12, height: 12 }} />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Generate Reply
            </>
          )}
        </Button>
      )}
    </div>
  );
}
