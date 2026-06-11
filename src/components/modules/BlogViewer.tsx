import * as React from "react";
import { marked } from "marked";
import { Copy01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";

interface BlogViewerProps {
  post: BlogPost;
}

export function BlogViewer({ post }: BlogViewerProps) {
  const html = React.useMemo(() => {
    const result = marked.parse(post.content);
    return typeof result === "string" ? result : "";
  }, [post.content]);

  function copyMarkdown() {
    navigator.clipboard.writeText(post.content).then(() => toast.success("Markdown copied!"));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
            {post.title}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
            {new Date(post.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" · "}
            {post.keywords.join(", ")}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={copyMarkdown}>
          <Copy01Icon size={13} />
          Copy Markdown
        </Button>
      </div>

      <div
        className="blog-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
