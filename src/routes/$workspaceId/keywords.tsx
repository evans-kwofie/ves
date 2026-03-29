import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { KeywordList } from "~/components/keywords/KeywordList";
import { AddKeywordDialog } from "~/components/keywords/AddKeywordDialog";
import { Button } from "~/components/ui/button";
import { Add01Icon, AiMagicIcon } from "hugeicons-react";
import { listKeywords } from "~/db/queries/keywords";
import { GenerateKeywordsDialog } from "~/components/keywords/GenerateKeywordsDialog";
import type { Keyword } from "~/types/keyword";

const getKeywords = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listKeywords(orgId));

export const Route = createFileRoute("/$workspaceId/keywords")({
  loader: ({ params }) => getKeywords({ data: params.workspaceId }),
  component: KeywordsPage,
});

function KeywordsPage() {
  const initial = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [keywords, setKeywords] = React.useState<Keyword[]>(initial);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);

  return (
    <>
      <Header
        title="Keywords"
        subtitle="Manage the keywords that drive your Reddit monitoring, LinkedIn search, and blog generation."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={() => setGenerateOpen(true)}>
              <AiMagicIcon size={14} />
              Generate
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Add01Icon size={14} />
              Add Keyword
            </Button>
          </div>
        }
      />
      <div className="page-content">
        <KeywordList keywords={keywords} onChange={setKeywords} />
      </div>

      <AddKeywordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={workspaceId}
        onSuccess={(kw) => setKeywords((prev) => [kw, ...prev])}
      />

      <GenerateKeywordsDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        orgId={workspaceId}
        onSuccess={(newKws) => setKeywords((prev) => [...newKws, ...prev])}
      />
    </>
  );
}
