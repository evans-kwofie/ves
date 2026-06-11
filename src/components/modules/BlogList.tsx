import * as React from "react";
import { File01Icon, Delete01Icon } from "hugeicons-react";
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
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  }

  if (posts.length === 0) {
    return <p className="text-[12px] text-[var(--muted-foreground)] py-3">No posts yet. Generate your first one.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {posts.map((post) => (
        <div
          key={post.id}
          onClick={() => onSelect(post)}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer transition-all ${
            selectedId === post.id
              ? "bg-[var(--accent-subtle)] border border-[var(--accent)]/20"
              : "border border-transparent hover:bg-[var(--muted)]"
          }`}
        >
          <File01Icon size={13} className={`shrink-0 mt-0.5 ${selectedId === post.id ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-semibold truncate ${selectedId === post.id ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
              {post.title}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleDelete(e, post)}
            disabled={deletingId === post.id}
            className="p-1 text-[var(--muted-foreground)] shrink-0"
          >
            <Delete01Icon size={11} />
          </Button>
        </div>
      ))}
    </div>
  );
}
