import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { RedditFeed } from "~/components/modules/RedditFeed";
import { SubredditPanel } from "~/components/modules/SubredditPanel";
import { KeywordSuggestions } from "~/components/modules/reddit/KeywordSuggestions";
import { Button } from "~/components/ui/button";
import { Settings01Icon, AiMagicIcon } from "hugeicons-react";
import { listKeywords } from "~/db/queries/keywords";
import { listRedditPosts } from "~/db/queries/reddit";
import type { RedditPost } from "~/types/reddit";
import type { Keyword } from "~/types/keyword";
import { redditFilterSchema } from "~/schema/reddit.schema";

// TopBar = 52px, page-header = 68px
const CONTENT_HEIGHT = "calc(100vh - 52px - 68px)";

const getRedditData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => {
    const [keywords, posts] = await Promise.all([listKeywords(orgId), listRedditPosts(orgId)]);
    return { keywords, posts };
  });

export const Route = createFileRoute("/$workspaceId/reddit")({
  validateSearch: (search) => redditFilterSchema.parse(search),
  loader: ({ params }) => getRedditData({ data: params.workspaceId }),
  component: RedditPage,
});

function RedditPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [keywords, setKeywords] = React.useState<Keyword[]>(initial.keywords);
  const [posts, setPosts] = React.useState<RedditPost[]>(initial.posts);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [subDrawerOpen, setSubDrawerOpen] = React.useState(false);

  const searchParams = Route.useSearch();
  const navigator = Route.useNavigate();

  const selectedKeywordId = searchParams?.keyword === "" ? null : searchParams?.keyword;

  const filteredPosts = selectedKeywordId
    ? posts.filter((p) => p.keywordId === selectedKeywordId)
    : posts;

  const postCountByKeyword = React.useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      if (p.keywordId) counts[p.keywordId] = (counts[p.keywordId] ?? 0) + 1;
    });
    return counts;
  }, [posts]);

  const noKeywords = keywords.length === 0;

  function selectKeyword(id: string | null) {
    navigator({ search: (prev) => ({ ...prev, keyword: (id ?? "") as any }) });
  }

  return (
    <>
      <Header
        title="Reddit"
        subtitle="Monitor subreddits for keyword mentions and generate reply suggestions."
        actions={
          <div className="flex items-center gap-2">
            {!noKeywords && (
              <Button variant="ghost" onClick={() => setSuggestOpen((v) => !v)}>
                <AiMagicIcon size={14} />
                Suggest keywords
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSubDrawerOpen(true)}>
              <Settings01Icon size={14} />
              Manage Subreddits
            </Button>
          </div>
        }
      />

      <div className="flex overflow-hidden" style={{ height: CONTENT_HEIGHT }}>
        {/* Keyword sidebar */}
        {!noKeywords && !suggestOpen && (
          <aside className="w-52 shrink-0 flex flex-col border-r border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Keywords
              </p>
            </div>
            <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
              <KeywordNavItem
                label="All"
                count={posts.length}
                active={selectedKeywordId === null}
                onClick={() => selectKeyword(null)}
              />
              {keywords.map((k) => (
                <KeywordNavItem
                  key={k.id}
                  label={k.keyword}
                  count={postCountByKeyword[k.id] ?? 0}
                  active={selectedKeywordId === k.id}
                  subreddits={(k.subreddits ?? []).map((s) => s.name)}
                  onClick={() => selectKeyword(k.id)}
                />
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {noKeywords || suggestOpen ? (
            <KeywordSuggestions
              orgId={workspaceId}
              existingKeywords={keywords}
              onKeywordsChange={(updated) => {
                setKeywords(updated);
                if (suggestOpen && updated.length > keywords.length) setSuggestOpen(false);
              }}
            />
          ) : (
            <RedditFeed
              orgId={workspaceId}
              posts={filteredPosts}
              selectedKeywordId={selectedKeywordId}
              onPostsUpdated={setPosts}
            />
          )}
        </div>
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

function KeywordNavItem({
  label,
  count,
  active,
  subreddits = [],
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  subreddits?: string[];
  onClick: () => void;
}) {
  return (
    <div>
      <button
        onClick={onClick}
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded text-[12px] transition-colors text-left ${
          active
            ? "bg-accent-subtle text-accent font-semibold"
            : "text-foreground hover:bg-muted"
        }`}
      >
        <span className="truncate">{label}</span>
        {count > 0 && (
          <span className={`text-[10px] shrink-0 ml-2 tabular-nums ${active ? "text-accent" : "text-muted-foreground"}`}>
            {count}
          </span>
        )}
      </button>
      {subreddits.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 px-3 pt-0.5 pb-1.5">
          {subreddits.map((s) => (
            <span key={s} className={`text-[10px] ${active ? "text-accent/70" : "text-muted-foreground"}`}>
              r/{s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
