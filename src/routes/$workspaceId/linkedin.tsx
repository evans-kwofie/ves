import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { LeadSearchPanel } from "~/components/linkedin/LeadSearchPanel";
import { LinkedInPostGenerator } from "~/components/linkedin/LinkedInPostGenerator";
import { listKeywords } from "~/db/queries/keywords";

const getLinkedInData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listKeywords(orgId));

export const Route = createFileRoute("/$workspaceId/linkedin")({
  loader: ({ params }) => getLinkedInData({ data: params.workspaceId }),
  component: LinkedInPage,
});

function LinkedInPage() {
  const keywords = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const [activeTab, setActiveTab] = React.useState<"search" | "posts">("search");

  return (
    <>
      <Header
        title="LinkedIn"
        subtitle="Find leads and generate LinkedIn content based on your keywords."
      />
      <div className="page-content">
        <div className="tab-list">
          <button className="tab-trigger" data-state={activeTab === "search" ? "active" : "inactive"} onClick={() => setActiveTab("search")}>
            Lead Search
          </button>
          <button className="tab-trigger" data-state={activeTab === "posts" ? "active" : "inactive"} onClick={() => setActiveTab("posts")}>
            Post Generator
          </button>
        </div>

        {activeTab === "search" ? (
          <LeadSearchPanel orgId={workspaceId} keywords={keywords} />
        ) : (
          <LinkedInPostGenerator orgId={workspaceId} keywords={keywords} />
        )}
      </div>
    </>
  );
}
