import * as React from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";

interface BlogListProps {
  posts: BlogPost[];
  selectedId: string | null;
  onSelect: (post: BlogPost) => void;
  onDelete: (id: string) => void;
}

export function BlogList({ posts, selectedId, onSelect, onDelete }: BlogListProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, post: BlogPost) {
    e.stopPropagation();
    setDeletingId(post.id);
    try {
      await fetch(`/api/blog/${post.id}`, { method: "DELETE" });
      onDelete(post.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  if (posts.length === 0) {
    return (
      <div style={{ color: "var(--muted-foreground)", fontSize: 12, padding: "12px 0" }}>
        No posts yet. Generate your first blog post.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {posts.map((post) => (
        <div
          key={post.id}
          onClick={() => onSelect(post)}
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            background: selectedId === post.id ? "var(--accent-subtle)" : "transparent",
            border: selectedId === post.id
              ? "1px solid rgba(34, 197, 94, 0.2)"
              : "1px solid transparent",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <FileText
            size={13}
            style={{
              color: selectedId === post.id ? "var(--accent)" : "var(--muted-foreground)",
              flexShrink: 0,
              marginTop: 2,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: selectedId === post.id ? "var(--accent)" : "var(--foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {post.title}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
              {new Date(post.createdAt).toLocaleDateString()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleDelete(e, post)}
            disabled={deletingId === post.id}
            style={{ padding: "2px 4px", color: "var(--muted-foreground)", flexShrink: 0 }}
          >
            <Trash2 size={11} />
          </Button>
        </div>
      ))}
    </div>
  );
}
