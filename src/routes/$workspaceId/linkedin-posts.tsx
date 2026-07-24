import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { LinkedInPostGenerator } from "~/components/modules/LinkedInPostGenerator";
import { listKeywords } from "~/db/queries/keywords";

const getKeywords = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listKeywords(orgId));

export const Route = createFileRoute("/$workspaceId/linkedin-posts")({
  loader: ({ params }) => getKeywords({ data: params.workspaceId }),
  component: LinkedInPostsPage,
});

function LinkedInPostsPage() {
  const keywords = Route.useLoaderData();
  const { workspaceId } = Route.useParams();

  return (
    <>
      <Header
        title="Post Generator"
        subtitle="Generate LinkedIn posts based on your keywords and topics."
      />
      <div className="page-content">
        <LinkedInPostGenerator orgId={workspaceId} keywords={keywords} />
      </div>
    </>
  );
}
