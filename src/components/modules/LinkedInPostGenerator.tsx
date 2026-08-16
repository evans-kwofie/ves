import * as React from "react";
import {
  Copy01Icon,
  Add01Icon,
  PencilEdit01Icon,
  Delete02Icon,
  Cancel01Icon,
  FloppyDiskIcon,
  Linkedin01Icon,
  NewTwitterIcon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "~/components/ui/sheet";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";
import type { LinkedInPost } from "~/types/linkedin";

const ANGLE_PRESETS = [
  "Founder lessons",
  "Contrarian take",
  "Behind the scenes",
  "Hot take",
  "Story-driven",
  "What I wish I knew",
  "Lessons from failure",
  "Unpopular opinion",
];

interface LinkedInPostGeneratorProps {
  orgId: string;
  keywords: Keyword[];
  initialPosts?: LinkedInPost[];
  linkedinConnected?: boolean;
  linkedinDisplayName?: string;
  linkedinPicture?: string;
}

export function LinkedInPostGenerator({
  orgId,
  keywords,
  initialPosts = [],
  linkedinConnected = false,
  linkedinDisplayName = "",
  linkedinPicture = "",
}: LinkedInPostGeneratorProps) {
  const [posts, setPosts] = React.useState<LinkedInPost[]>(initialPosts);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [editPost, setEditPost] = React.useState<LinkedInPost | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);

  function handleSaved(post: LinkedInPost) {
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === post.id);
      return exists ? prev.map((p) => (p.id === post.id ? post : p)) : [post, ...prev];
    });
  }

  function handleUpdated(post: LinkedInPost) {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    setEditPost(null);
  }

  async function deletePost(id: string) {
    try {
      await fetch(`/api/linkedin/${id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  async function publishToLinkedIn(post: LinkedInPost) {
    if (linkedinConnected) {
      setPublishingId(post.id);
      try {
        const res = await fetch("/api/linkedin/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            content: post.content,
            postId: post.id,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          linkedinPostUrl?: string | null;
        };
        if (data.ok) {
          const updated = { ...post, postedAt: new Date().toISOString() };
          setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
          if (data.linkedinPostUrl) {
            window.open(data.linkedinPostUrl, "_blank", "noopener,noreferrer");
          }
          toast.success("Posted to LinkedIn");
        } else if (
          data.error === "linkedin_token_revoked" ||
          data.error === "linkedin_token_expired"
        ) {
          toast.error("LinkedIn access revoked", {
            description: "Reconnect in Settings → Integrations",
          });
        } else {
          toast.error("Failed to post to LinkedIn");
        }
      } catch {
        toast.error("Failed to post to LinkedIn");
      } finally {
        setPublishingId(null);
      }
    } else {
      navigator.clipboard.writeText(post.content);
      window.open(
        `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(post.content)}`,
        "_blank",
        "noopener,noreferrer",
      );
      toast.info("Full text copied — paste if LinkedIn truncates it");
    }
  }

  function shareTwitter(text: string) {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <EmptyState
          icon={<PencilEdit01Icon />}
          title="No posts yet"
          description="Generate posts from your tracked keywords, crafted in a founder voice and ready to publish."
          action={
            <Button onClick={() => setGenerateOpen(true)}>
              <Add01Icon size={13} /> New post
            </Button>
          }
        />
        <GeneratorSheet
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          orgId={orgId}
          keywords={keywords}
          onSaved={handleSaved}
          linkedinConnected={linkedinConnected}
        />
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {posts.length} {posts.length === 1 ? "post" : "posts"} generated from your keywords — ready to copy, edit, or publish.
          </p>
        </div>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>
          <Add01Icon size={13} /> New post
        </Button>
      </div>

      {/* Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
        {posts.map((post) => {
          const isPublishing = publishingId === post.id;
          return (
            <div key={post.id} className="card p-4 flex flex-col gap-3">
              {/* Card header */}
              <div className="flex items-center gap-2.5">
                {linkedinPicture ? (
                  <img
                    src={linkedinPicture}
                    alt={linkedinDisplayName}
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: "#0A66C2",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {(linkedinDisplayName || "Y").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                    {linkedinDisplayName || "Your Name"} <span className="font-normal text-muted-foreground">· 1st</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {post.postedAt && <span className="ml-2 text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>· Posted</span>}
                  </p>
                </div>
              </div>

              {/* Content preview */}
              <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap line-clamp-6 flex-1">
                {post.content}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => copy(post.content)}>
                  <Copy01Icon size={13} /> Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => publishToLinkedIn(post)}
                  disabled={isPublishing || !!post.postedAt}
                >
                  <Linkedin01Icon size={13} />
                  {isPublishing ? "Posting…" : post.postedAt ? "Posted" : linkedinConnected ? "Post" : "LinkedIn"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => shareTwitter(post.content)}>
                  <NewTwitterIcon size={13} /> X
                </Button>
                <div style={{ flex: 1 }} />
                <Button variant="ghost" size="sm" onClick={() => setEditPost(post)}>
                  <PencilEdit01Icon size={13} />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deletePost(post.id)}>
                  <Delete02Icon size={13} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <GeneratorSheet
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        orgId={orgId}
        keywords={keywords}
        onSaved={handleSaved}
        linkedinConnected={linkedinConnected}
      />
      <EditSheet
        post={editPost}
        onClose={() => setEditPost(null)}
        onSaved={handleUpdated}
      />
    </>
  );
}

// ── Edit sheet ─────────────────────────────────────────────────────────────────

function EditSheet({
  post,
  onClose,
  onSaved,
}: {
  post: LinkedInPost | null;
  onClose: () => void;
  onSaved: (post: LinkedInPost) => void;
}) {
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (post) setContent(post.content);
  }, [post?.id]);

  async function save() {
    if (!post || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/linkedin/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { post?: LinkedInPost };
      if (data.post) {
        onSaved(data.post);
        toast.success("Post updated");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={!!post}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit post</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input w-full"
            style={{
              minHeight: 360,
              lineHeight: 1.7,
              fontSize: 13,
              resize: "vertical",
            }}
            autoFocus
          />
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="ghost" onClick={onClose}>
            <Cancel01Icon size={13} /> Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            style={{ marginLeft: "auto" }}
          >
            <FloppyDiskIcon size={13} /> {saving ? "Saving..." : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Generator sheet ────────────────────────────────────────────────────────────

function GeneratorSheet({
  open,
  onOpenChange,
  orgId,
  keywords,
  onSaved,
  linkedinConnected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  keywords: Keyword[];
  onSaved: (post: LinkedInPost) => void;
  linkedinConnected: boolean;
}) {
  const [selectedKeywordId, setSelectedKeywordId] = React.useState(
    keywords[0]?.id ?? "",
  );
  const [selectedKeyword, setSelectedKeyword] = React.useState(
    keywords[0]?.keyword ?? "",
  );
  const [customKeyword, setCustomKeyword] = React.useState("");
  const [angle, setAngle] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const activeKeyword = keywords.length > 0 ? selectedKeyword : customKeyword;

  React.useEffect(() => {
    if (open) {
      setAngle("");
      setCustomKeyword("");
    }
  }, [open]);

  function selectKeyword(k: Keyword) {
    setSelectedKeywordId(k.id);
    setSelectedKeyword(k.keyword);
  }

  async function generateAndSave(andPublish = false) {
    if (!activeKeyword) return;
    setGenerating(true);
    try {
      const genRes = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keyword: activeKeyword,
          angle: angle || undefined,
          keywordId: selectedKeywordId || undefined,
        }),
      });
      const genData = (await genRes.json()) as {
        content?: string;
        error?: string;
      };
      if (!genData.content) {
        toast.error("Failed to generate post");
        return;
      }

      const saveRes = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          keyword: activeKeyword,
          keywordId: selectedKeywordId || undefined,
          content: genData.content,
        }),
      });
      const saveData = (await saveRes.json()) as { post?: LinkedInPost };
      if (!saveData.post) {
        toast.error("Failed to save post");
        return;
      }

      if (andPublish) {
        const pubRes = await fetch("/api/linkedin/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            content: genData.content,
            postId: saveData.post.id,
          }),
        });
        const pubData = (await pubRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          linkedinPostUrl?: string | null;
        };
        if (pubData.ok) {
          const now = new Date().toISOString();
          onSaved({ ...saveData.post, postedAt: now });
          onOpenChange(false);
          if (pubData.linkedinPostUrl) {
            window.open(
              pubData.linkedinPostUrl,
              "_blank",
              "noopener,noreferrer",
            );
          }
          toast.success("Posted to LinkedIn");
        } else if (
          pubData.error === "linkedin_token_revoked" ||
          pubData.error === "linkedin_token_expired"
        ) {
          onSaved(saveData.post);
          onOpenChange(false);
          toast.error("LinkedIn access revoked", {
            description: "Reconnect in Settings → Integrations",
          });
        } else {
          onSaved(saveData.post);
          onOpenChange(false);
          toast.error("Saved but failed to post to LinkedIn");
        }
      } else {
        onSaved(saveData.post);
        onOpenChange(false);
        toast.success("Post saved");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>New post</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Topic
            </p>
            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => selectKeyword(k)}
                    className="px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors"
                    style={{
                      background:
                        selectedKeywordId === k.id
                          ? "var(--accent)"
                          : "transparent",
                      color:
                        selectedKeywordId === k.id
                          ? "#fff"
                          : "var(--muted-foreground)",
                      borderColor:
                        selectedKeywordId === k.id
                          ? "var(--accent)"
                          : "var(--border)",
                    }}
                  >
                    {k.keyword}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="input text-[13px]"
                placeholder="Enter a topic or keyword..."
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Angle{" "}
              <span className="normal-case font-normal tracking-normal">
                — optional
              </span>
            </p>
            <textarea
              className="input text-[13px]"
              placeholder="e.g. contrarian take, lessons from failure..."
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              style={{ minHeight: 72, resize: "vertical", lineHeight: 1.6 }}
            />
            <div className="flex flex-wrap gap-1.5">
              {ANGLE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAngle(angle === p ? "" : p)}
                  className="px-2 py-0.5 rounded text-[11px] border transition-colors"
                  style={{
                    background:
                      angle === p
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "transparent",
                    color:
                      angle === p ? "var(--accent)" : "var(--muted-foreground)",
                    borderColor:
                      angle === p
                        ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                        : "var(--border)",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex flex-col gap-2">
          {linkedinConnected && (
            <Button
              onClick={() => generateAndSave(true)}
              disabled={generating || !activeKeyword}
              className="w-full"
            >
              {generating ? (
                <>
                  <span className="spinner" /> Generating...
                </>
              ) : (
                "Generate & post to LinkedIn"
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => generateAndSave(false)}
            disabled={generating || !activeKeyword}
            className="w-full"
          >
            {generating ? (
              <>
                <span className="spinner" /> Generating...
              </>
            ) : (
              "Generate & save"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
