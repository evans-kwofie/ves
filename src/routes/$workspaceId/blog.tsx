import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { BlogGenerator } from "~/components/modules/BlogGenerator";
import { BlogList } from "~/components/modules/BlogList";
import { BlogViewer } from "~/components/modules/BlogViewer";
import { Button } from "~/components/ui/button";
import { AiMagicIcon } from "hugeicons-react";
import { listBlogPosts } from "~/db/queries/blog";
import { listKeywords } from "~/db/queries/keywords";
import type { BlogPost } from "~/types/blog";
import type { Keyword } from "~/types/keyword";

const getBlogData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => {
    const [posts, keywords] = await Promise.all([listBlogPosts(orgId), listKeywords(orgId)]);
    return { posts, keywords };
  });

export const Route = createFileRoute("/$workspaceId/blog")({
  loader: ({ params }) => getBlogData({ data: params.workspaceId }),
  component: BlogPage,
});

function BlogPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [posts, setPosts] = React.useState<BlogPost[]>(initial.posts);
  const [keywords] = React.useState<Keyword[]>(initial.keywords);
  const [selectedPost, setSelectedPost] = React.useState<BlogPost | null>(initial.posts[0] ?? null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  function handleGenerated(post: BlogPost) {
    setPosts((prev) => [post, ...prev]);
    setSelectedPost(post);
  }

  function handleDelete(id: string) {
    setPosts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (selectedPost?.id === id) setSelectedPost(updated[0] ?? null);
      return updated;
    });
  }

  return (
    <>
      <Header
        title="Blog Posts"
        subtitle="AI-written posts based on your keywords and ICP."
        actions={
          <Button onClick={() => setDrawerOpen(true)}>
            <AiMagicIcon size={14} />
            Generate Post
          </Button>
        }
      />

      <div className="page-content">
        {posts.length === 0 ? (
          <div className="empty-state">
            <div style={{ marginBottom: 16 }}>No posts yet — generate your first one.</div>
            <button className="btn btn-primary btn-sm" onClick={() => setDrawerOpen(true)}>
              <AiMagicIcon size={13} />
              Generate Post
            </button>
          </div>
        ) : (
          <div className="grid gap-5 min-h-[400px]" style={{ gridTemplateColumns: "220px 1fr" }}>
            {/* Post list */}
            <div style={{ borderRight: "1px solid var(--border)", paddingRight: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted-foreground)", marginBottom: 10 }}>
                Saved ({posts.length})
              </p>
              <BlogList
                posts={posts}
                selectedId={selectedPost?.id ?? null}
                onSelect={setSelectedPost}
                onDelete={handleDelete}
              />
            </div>

            {/* Post viewer */}
            <div>
              {selectedPost ? (
                <BlogViewer post={selectedPost} />
              ) : (
                <div className="empty-state">Select a post to read it.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <BlogGenerator
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orgId={workspaceId}
        keywords={keywords}
        onGenerated={handleGenerated}
      />
    </>
  );
}
