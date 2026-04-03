import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { RedditFeed } from "~/components/reddit/RedditFeed";
import { SubredditPanel } from "~/components/reddit/SubredditPanel";
import { Button } from "~/components/ui/button";
import { Settings01Icon } from "hugeicons-react";
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
  const [subDrawerOpen, setSubDrawerOpen] = React.useState(false);

  const filteredPosts = selectedKeywordId
    ? posts.filter((p) => p.keywordId === selectedKeywordId)
    : posts;

  return (
    <>
      <Header
        title="Reddit"
        subtitle="Monitor subreddits for keyword mentions and generate reply suggestions."
        actions={
          <Button variant="outline" onClick={() => setSubDrawerOpen(true)}>
            <Settings01Icon size={14} />
            Manage Subreddits
          </Button>
        }
      />
      <div className="page-content">
        <RedditFeed
          orgId={workspaceId}
          posts={filteredPosts}
          keywords={keywords}
          selectedKeywordId={selectedKeywordId}
          onSelectKeyword={setSelectedKeywordId}
          onPostsUpdated={setPosts}
        />
      </div>

      <SubredditPanel
        open={subDrawerOpen}
        onOpenChange={setSubDrawerOpen}
        keywords={keywords}
        onKeywordsChange={setKeywords}
      />
    </>
  );
}
