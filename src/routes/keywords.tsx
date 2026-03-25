import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Header } from "~/components/layout/Header";
import { KeywordList } from "~/components/keywords/KeywordList";
import { AddKeywordDialog } from "~/components/keywords/AddKeywordDialog";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { initDb } from "~/db/schema";
import { listKeywords } from "~/db/queries/keywords";
import type { Keyword } from "~/types/keyword";

const getKeywords = createServerFn().handler(async () => {
  await initDb();
  return listKeywords();
});

export const Route = createFileRoute("/keywords")({
  loader: () => getKeywords(),
  component: KeywordsPage,
});

function KeywordsPage() {
  const initial = Route.useLoaderData();
  const [keywords, setKeywords] = React.useState<Keyword[]>(initial);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <Header
        title="Keywords"
        subtitle="Manage the keywords that drive your Reddit monitoring, LinkedIn search, and blog generation."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={14} />
            Add Keyword
          </Button>
        }
      />
      <div className="page-content">
        <KeywordList keywords={keywords} onChange={setKeywords} />
      </div>

      <AddKeywordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(kw) => setKeywords((prev) => [kw, ...prev])}
      />
    </>
  );
}
