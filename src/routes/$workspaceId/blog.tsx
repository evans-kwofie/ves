import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { BlogGenerator } from "~/components/blog/BlogGenerator";
import { BlogList } from "~/components/blog/BlogList";
import { BlogViewer } from "~/components/blog/BlogViewer";
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
        subtitle="Generate and manage AI-written blog posts based on your keywords."
      />
      <div className="page-content">
        <BlogGenerator orgId={workspaceId} keywords={keywords} onGenerated={handleGenerated} />

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, minHeight: 400 }}>
          <div style={{ borderRight: "1px solid var(--border)", paddingRight: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: 10 }}>
              Saved Posts ({posts.length})
            </div>
            <BlogList
              posts={posts}
              selectedId={selectedPost?.id ?? null}
              onSelect={setSelectedPost}
              onDelete={handleDelete}
            />
          </div>
          <div>
            {selectedPost ? (
              <BlogViewer post={selectedPost} />
            ) : (
              <div className="empty-state">
                <div>Select a post to view it, or generate a new one above.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
