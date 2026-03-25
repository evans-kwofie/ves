import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Header } from "~/components/layout/Header";
import { LeadSearchPanel } from "~/components/linkedin/LeadSearchPanel";
import { LinkedInPostGenerator } from "~/components/linkedin/LinkedInPostGenerator";
import { initDb } from "~/db/schema";
import { listKeywords } from "~/db/queries/keywords";

const getLinkedInData = createServerFn().handler(async () => {
  await initDb();
  return listKeywords();
});

export const Route = createFileRoute("/linkedin")({
  loader: () => getLinkedInData(),
  component: LinkedInPage,
});

function LinkedInPage() {
  const keywords = Route.useLoaderData();
  const [activeTab, setActiveTab] = React.useState<"search" | "posts">("search");

  return (
    <>
      <Header
        title="LinkedIn"
        subtitle="Find leads and generate LinkedIn content based on your keywords."
      />
      <div className="page-content">
        <div className="tab-list">
          <button
            className="tab-trigger"
            data-state={activeTab === "search" ? "active" : "inactive"}
            onClick={() => setActiveTab("search")}
          >
            Lead Search
          </button>
          <button
            className="tab-trigger"
            data-state={activeTab === "posts" ? "active" : "inactive"}
            onClick={() => setActiveTab("posts")}
          >
            Post Generator
          </button>
        </div>

        {activeTab === "search" ? (
          <LeadSearchPanel keywords={keywords} />
        ) : (
          <LinkedInPostGenerator keywords={keywords} />
        )}
      </div>
    </>
  );
}
