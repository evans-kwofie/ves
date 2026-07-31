import * as React from "react";
import { marked } from "marked";
import { Copy01Icon, PencilEdit01Icon, Tick01Icon, Cancel01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";

interface BlogViewerProps {
  post: BlogPost;
  onUpdate?: (post: BlogPost) => void;
}

export function BlogViewer({ post, onUpdate }: BlogViewerProps) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(post.title);
  const [content, setContent] = React.useState(post.content);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setTitle(post.title);
    setContent(post.content);
    setEditing(false);
  }, [post.id]);

  const html = React.useMemo(() => {
    const result = marked.parse(content);
    return typeof result === "string" ? result : "";
  }, [content]);

  function cancel() {
    setTitle(post.title);
    setContent(post.content);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as BlogPost;
      onUpdate?.(updated);
      setEditing(false);
      toast.success("Post saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(content).then(() => toast.success("Copied"));
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-border focus:border-accent outline-none pb-1 text-[15px] font-bold tracking-tight text-foreground"
            />
          ) : (
            <div className="text-[15px] font-bold tracking-tight text-foreground">{post.title}</div>
          )}
          <div className="text-[11px] text-muted-foreground mt-1">
            {new Date(post.createdAt).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
            {" · "}
            {post.keywords.join(", ")}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                <Cancel01Icon size={13} /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Tick01Icon size={13} /> {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={copyMarkdown}>
                <Copy01Icon size={13} /> Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <PencilEdit01Icon size={13} /> Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <RichTextEditor content={content} onChange={setContent} />
      ) : (
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
