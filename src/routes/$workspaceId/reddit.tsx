import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { RedditFeed } from "~/components/reddit/RedditFeed";
import { SubredditPanel } from "~/components/reddit/SubredditPanel";
import { listKeywords } from "~/db/queries/keywords";
import { listRedditPosts } from "~/db/queries/reddit";
import type { RedditPost } from "~/types/reddit";
import type { Keyword } from "~/types/keyword";

const getRedditData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => {
    const [keywords, posts] = await Promise.all([listKeywords(orgId), listRedditPosts(orgId)]);
    return { keywords, posts };
  });

export const Route = createFileRoute("/$workspaceId/reddit")({
  loader: ({ params }) => getRedditData({ data: params.workspaceId }),
  component: RedditPage,
});

function RedditPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [keywords, setKeywords] = React.useState<Keyword[]>(initial.keywords);
  const [posts, setPosts] = React.useState<RedditPost[]>(initial.posts);
  const [selectedKeywordId, setSelectedKeywordId] = React.useState<string | null>(null);

  const filteredPosts = selectedKeywordId
    ? posts.filter((p) => p.keywordId === selectedKeywordId)
    : posts;

  return (
    <>
      <Header
        title="Reddit"
        subtitle="Monitor subreddits for keyword mentions and generate reply suggestions."
      />
      <div className="page-content">
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: 12 }}>
              Subreddits
            </div>
            <SubredditPanel keywords={keywords} onKeywordsChange={setKeywords} />
          </div>
          <div>
            <RedditFeed
              orgId={workspaceId}
              posts={filteredPosts}
              keywords={keywords}
              selectedKeywordId={selectedKeywordId}
              onSelectKeyword={setSelectedKeywordId}
              onPostsUpdated={setPosts}
            />
          </div>
        </div>
      </div>
    </>
  );
}
