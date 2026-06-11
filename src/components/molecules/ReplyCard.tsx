import * as React from "react";
import { ArrowDiagonalIcon, Copy01Icon, AiMagicIcon, ArrowUp01Icon, UserAdd01Icon, CheckmarkCircle01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { RedditPost, IntentType, EngagementType } from "~/types/reddit";

const INTENT_LABEL: Record<IntentType, string> = {
  buying: "Buying",
  pain: "Pain point",
  discussion: "Discussion",
  noise: "Noise",
};

const INTENT_COLOR: Record<IntentType, string> = {
  buying: "var(--accent)",
  pain: "#f59e0b",
  discussion: "var(--muted-foreground)",
  noise: "var(--muted-foreground)",
};

const ENGAGEMENT_LABEL: Record<EngagementType, string> = {
  helpful: "Be helpful",
  pitch: "Soft pitch",
  authority: "Build authority",
  question: "Ask a question",
};

interface ReplyCardProps {
  orgId: string;
  post: RedditPost;
  onSuggestionSaved: (postId: string, suggestion: string) => void;
}

export function ReplyCard({ orgId, post, onSuggestionSaved }: ReplyCardProps) {
  const [generating, setGenerating] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(post.replySuggestion ?? "");
  const [pipelineState, setPipelineState] = React.useState<"idle" | "saving" | "saved" | "duplicate">("idle");

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
          engagementType: post.engagementType ?? null,
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

  async function addToPipeline() {
    setPipelineState("saving");
    try {
      const res = await fetch("/api/reddit/to-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          postId: post.id,
          author: post.author,
          title: post.title,
          subreddit: post.subreddit,
          url: post.url,
          intentType: post.intentType ?? null,
        }),
      });
      if (res.status === 409) {
        setPipelineState("duplicate");
        toast.info("Already in pipeline");
      } else if (res.ok) {
        setPipelineState("saved");
        toast.success(`u/${post.author} added to pipeline`);
      } else {
        setPipelineState("idle");
        toast.error("Failed to add to pipeline");
      }
    } catch {
      setPipelineState("idle");
      toast.error("Failed to add to pipeline");
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
          <ArrowDiagonalIcon size={13} />
        </a>
      </div>

      <div className="reddit-card-meta">
        <span style={{ color: "var(--accent)" }}>r/{post.subreddit}</span>
        <span>u/{post.author}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <ArrowUp01Icon size={11} />
          {post.score}
        </span>
        <span>{new Date(post.fetchedAt).toLocaleDateString()}</span>
        {post.intentType && (
          <span
            style={{
              color: INTENT_COLOR[post.intentType],
              fontWeight: 600,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginLeft: "auto",
            }}
          >
            {INTENT_LABEL[post.intentType]}
            {post.intentScore !== null ? ` · ${post.intentScore}` : ""}
          </span>
        )}
      </div>

      {post.body && <p className="reddit-card-body">{post.body}</p>}

      {/* Actions row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        {/* Reply section */}
        <div style={{ flex: 1 }}>
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
                {post.engagementType && (
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted-foreground)", marginLeft: 8 }}>
                    — {ENGAGEMENT_LABEL[post.engagementType]}
                  </span>
                )}
              </div>
              <div className="reddit-card-reply">{suggestion}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Button variant="ghost" size="sm" onClick={copyReply}>
                  <Copy01Icon size={12} />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
                  <AiMagicIcon size={12} />
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
                {generating ? (
                  <>
                    <span className="spinner" style={{ width: 12, height: 12 }} />
                    Generating...
                  </>
                ) : (
                  <>
                    <AiMagicIcon size={12} />
                    Generate Reply
                  </>
                )}
              </Button>
              {post.engagementType && !generating && (
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  Angle: {ENGAGEMENT_LABEL[post.engagementType]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Add to Pipeline */}
        <div style={{ flexShrink: 0, marginLeft: 12 }}>
          {pipelineState === "saved" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent)" }}>
              <CheckmarkCircle01Icon size={14} />
              Added
            </span>
          ) : pipelineState === "duplicate" ? (
            <span
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                fontWeight: 500,
              }}
            >
              In pipeline
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={addToPipeline}
              disabled={pipelineState === "saving"}
              style={{ fontSize: 11 }}
            >
              {pipelineState === "saving" ? (
                <><span className="spinner" style={{ width: 11, height: 11 }} />Adding...</>
              ) : (
                <><UserAdd01Icon size={12} />Add to Pipeline</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
