import * as React from "react";
import { File01Icon, Delete01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { BlogPost } from "~/types/blog";

interface BlogListProps {
  posts: BlogPost[];
  selectedId: string | null;
  onSelect: (post: BlogPost) => void;
  onDelete: (id: string) => void;
}

export function BlogList({ posts, selectedId, onSelect, onDelete }: BlogListProps) {
  const [pendingDelete, setPendingDelete] = React.useState<BlogPost | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/blog/${pendingDelete.id}`, { method: "DELETE" });
      onDelete(pendingDelete.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  if (posts.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-3">No posts yet. Generate your first one.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => onSelect(post)}
            className={`flex items-start gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
              selectedId === post.id
                ? "bg-accent-subtle border border-accent/20"
                : "border border-transparent hover:bg-muted"
            }`}
          >
            <File01Icon size={13} className={`shrink-0 mt-0.5 ${selectedId === post.id ? "text-accent" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-semibold truncate ${selectedId === post.id ? "text-accent" : "text-foreground"}`}>
                {post.title}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setPendingDelete(post); }}
              className="p-1 text-muted-foreground shrink-0"
            >
              <Delete01Icon size={11} />
            </Button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title="Delete this post?"
        description={pendingDelete ? `"${pendingDelete.title}" will be permanently deleted.` : undefined}
        confirmLabel="Delete post"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
