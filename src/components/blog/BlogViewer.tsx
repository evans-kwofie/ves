import * as React from "react";
import { marked } from "marked";
import { Copy } from "lucide-react";
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {post.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
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
          <Copy size={13} />
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
