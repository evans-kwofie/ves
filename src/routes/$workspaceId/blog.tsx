import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { BlogGenerator } from "~/components/modules/BlogGenerator";
import { BlogList } from "~/components/modules/BlogList";
import { BlogViewer } from "~/components/modules/BlogViewer";
import { LinkedInPostGenerator } from "~/components/modules/LinkedInPostGenerator";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FlashIcon, File01Icon } from "hugeicons-react";
import { listBlogPosts } from "~/db/queries/blog";
import { listLinkedInPosts } from "~/db/queries/linkedin";
import { listKeywords } from "~/db/queries/keywords";
import { auth } from "~/lib/auth";
import type { BlogPost } from "~/types/blog";
import type { Keyword } from "~/types/keyword";
import type { LinkedInPost } from "~/types/linkedin";

const getContentData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => {
    const headers = getRequestHeaders();
    const [posts, linkedInPosts, keywords, orgs] = await Promise.all([
      listBlogPosts(orgId),
      listLinkedInPosts(orgId),
      listKeywords(orgId),
      auth.api.listOrganizations({ headers }),
    ]);
    const org = orgs?.find((o: { id: string; slug: string; metadata?: string }) => o.id === orgId || o.slug === orgId);
    let meta: Record<string, string> = {};
    try { meta = org?.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}
    const linkedinConnected = !!(meta.linkedinAccessToken && (!meta.linkedinTokenExpiry || Date.now() < Number(meta.linkedinTokenExpiry)));
    return {
      posts, linkedInPosts, keywords, linkedinConnected,
      linkedinDisplayName: meta.linkedinDisplayName ?? "",
      linkedinPicture: meta.linkedinPicture ?? "",
    };
  });

export const Route = createFileRoute("/$workspaceId/blog")({
  loader: ({ params }) => getContentData({ data: params.workspaceId }),
  component: ContentPage,
});

type Tab = "blog" | "linkedin";

function ContentPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [posts, setPosts] = React.useState<BlogPost[]>(initial.posts);
  const [keywords] = React.useState<Keyword[]>(initial.keywords);
  const [selectedPost, setSelectedPost] = React.useState<BlogPost | null>(initial.posts[0] ?? null);
  const [linkedInPosts] = React.useState<LinkedInPost[]>(initial.linkedInPosts);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("blog");

  function handleGenerated(post: BlogPost) {
    setPosts((prev) => [post, ...prev]);
    setSelectedPost(post);
  }

  function handleUpdate(updated: BlogPost) {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelectedPost(updated);
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
        title="Content"
        subtitle="AI-written posts based on your keywords and ICP."
        actions={
          tab === "blog" ? (
            <Button onClick={() => setDrawerOpen(true)}>
              <FlashIcon size={14} />
              Generate post
            </Button>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border px-6">
        {(["blog", "linkedin"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "relative px-4 pt-2 pb-3 text-[13px] font-medium transition-colors bg-transparent border-0 cursor-pointer whitespace-nowrap",
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t === "blog" ? "Blog Posts" : "LinkedIn Posts"}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="page-content">
        {tab === "blog" && (
          <>
            {posts.length === 0 ? (
              <EmptyState
                icon={<File01Icon />}
                title="No blog posts yet"
                description="Generate your first post using your keywords and business context."
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => setDrawerOpen(true)}>
                    <FlashIcon size={13} />
                    Generate post
                  </button>
                }
              />
            ) : (
              <div className="grid gap-5 min-h-100" style={{ gridTemplateColumns: "220px 1fr" }}>
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
                <div>
                  {selectedPost ? (
                    <BlogViewer post={selectedPost} onUpdate={handleUpdate} />
                  ) : (
                    <EmptyState title="Select a post" description="Choose a post from the list to read it." size="sm" />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "linkedin" && (
          <LinkedInPostGenerator
          orgId={workspaceId}
          keywords={keywords}
          initialPosts={linkedInPosts}
          linkedinConnected={initial.linkedinConnected}
          linkedinDisplayName={initial.linkedinDisplayName}
          linkedinPicture={initial.linkedinPicture}
        />
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
