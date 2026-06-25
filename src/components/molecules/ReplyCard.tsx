import * as React from "react";
import {
  Copy01Icon,
  AiMagicIcon,
  ArrowUp01Icon,
  UserAdd01Icon,
  CheckmarkCircle01Icon,
  LinkCircleIcon,
  Cancel01Icon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Tip } from "~/components/ui/tooltip";
import { toast } from "sonner";
import type { RedditPost, IntentType, EngagementType } from "~/types/reddit";

const INTENT_LABEL: Record<IntentType, string> = {
  buying: "Buying",
  pain: "Pain point",
  discussion: "Discussion",
  noise: "Noise",
};

const INTENT_CLASS: Record<IntentType, string> = {
  buying: "text-accent",
  pain: "text-amber-400",
  discussion: "text-muted-foreground",
  noise: "text-muted-foreground",
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
  onDismiss: (postId: string) => void;
}

export function ReplyCard({ orgId, post, onSuggestionSaved, onDismiss }: ReplyCardProps) {
  const [generating, setGenerating] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(post.replySuggestion ?? "");
  const [pipelineState, setPipelineState] = React.useState<
    "idle" | "saving" | "saved" | "duplicate" | "removing"
  >("idle");
  const [leadId, setLeadId] = React.useState<string | null>(null);
  const [dismissing, setDismissing] = React.useState(false);

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
      const data = (await res.json()) as { lead?: { id: string }; leadId?: string; error?: string };
      if (res.status === 409) {
        setLeadId(data.leadId ?? null);
        setPipelineState("duplicate");
        toast.info("Already in pipeline");
      } else if (res.ok) {
        setLeadId(data.lead?.id ?? null);
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

  async function removeLead() {
    if (!leadId) return;
    setPipelineState("removing");
    try {
      const res = await fetch(`/api/pipeline/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        setLeadId(null);
        setPipelineState("idle");
        toast.success("Removed from pipeline");
      } else {
        setPipelineState("saved");
        toast.error("Failed to remove");
      }
    } catch {
      setPipelineState("saved");
      toast.error("Failed to remove");
    }
  }

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch(`/api/reddit/posts/${post.id}`, { method: "DELETE" });
      onDismiss(post.id);
    } catch {
      toast.error("Failed to dismiss post");
      setDismissing(false);
    }
  }

  return (
    <div className="group relative rounded-lg border border-card-border bg-card px-4 py-3.5 flex flex-col gap-3">
      {/* Title + actions */}
      <div className="flex items-start gap-2">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-semibold leading-snug text-foreground hover:text-accent transition-colors flex-1"
        >
          {post.title}
        </a>
        <div className="flex items-center gap-3 shrink-0 mt-0.5">
          <Tip label="View on Reddit">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <LinkCircleIcon size={13} />
            </a>
          </Tip>
          <Tip label="Dismiss post">
            <button
              onClick={dismiss}
              disabled={dismissing}
              className="text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all disabled:opacity-20 -m-1 p-1"
            >
              <Cancel01Icon size={15} />
            </button>
          </Tip>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground flex-wrap">
        <span className="text-accent font-medium">r/{post.subreddit}</span>
        <span>u/{post.author}</span>
        <span className="flex items-center gap-0.5">
          <ArrowUp01Icon size={10} />
          {post.score}
        </span>
        <span>{new Date(post.postedAt ?? post.fetchedAt).toLocaleDateString()}</span>
        {post.intentType && (
          <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${INTENT_CLASS[post.intentType]}`}>
            {INTENT_LABEL[post.intentType]}
            {post.intentScore != null ? ` · ${post.intentScore}` : ""}
          </span>
        )}
      </div>

      {/* Body */}
      {post.body && (
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
          {post.body}
        </p>
      )}

      {/* Reply + pipeline */}
      <div className="flex items-start justify-between gap-3 pt-0.5">
        <div className="flex-1 min-w-0">
          {suggestion ? (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                Suggested reply
                {post.engagementType && (
                  <span className="text-muted-foreground font-normal normal-case tracking-normal ml-2">
                    — {ENGAGEMENT_LABEL[post.engagementType]}
                  </span>
                )}
              </p>
              <p className="text-[12px] leading-relaxed text-foreground bg-accent-subtle border border-accent/15 rounded-lg px-3 py-2.5">
                {suggestion}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={copyReply}>
                  <Copy01Icon size={11} />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
                  <AiMagicIcon size={11} />
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={generateReply} disabled={generating}>
                <AiMagicIcon size={11} />
                {generating ? "Generating..." : "Generate reply"}
              </Button>
              {post.engagementType && !generating && (
                <span className="text-[11px] text-muted-foreground">
                  Angle: {ENGAGEMENT_LABEL[post.engagementType]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pipeline action */}
        <div className="shrink-0">
          {pipelineState === "saved" || pipelineState === "duplicate" || pipelineState === "removing" ? (
            <div className="flex items-center gap-1.5">
              {pipelineState === "duplicate" ? (
                <span className="text-[11px] px-2 py-1 rounded bg-amber-400/10 text-amber-400 font-medium">
                  In pipeline
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[12px] text-accent">
                  <CheckmarkCircle01Icon size={13} />
                  Added
                </span>
              )}
              {leadId && (
                <Tip label="Remove from pipeline">
                  <button
                    onClick={removeLead}
                    disabled={pipelineState === "removing"}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {pipelineState === "removing" ? (
                      <span className="w-2.5 h-2.5 rounded-full border border-muted-foreground/20 border-t-muted-foreground animate-spin inline-block" />
                    ) : (
                      <Cancel01Icon size={12} />
                    )}
                  </button>
                </Tip>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={addToPipeline}
              disabled={pipelineState === "saving"}
            >
              {pipelineState === "saving" ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full border border-accent/20 border-t-accent animate-spin shrink-0" />
                  Adding...
                </>
              ) : (
                <>
                  <UserAdd01Icon size={11} />
                  Add to pipeline
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
