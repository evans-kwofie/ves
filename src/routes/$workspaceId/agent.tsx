import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "~/components/templates/Header";
import { AgentConsole } from "~/components/modules/AgentConsole";

export const Route = createFileRoute("/$workspaceId/agent")({
  component: AgentPage,
});

function AgentPage() {
  const { workspaceId } = Route.useParams();
  return (
    <>
      <Header
        title="AI Agent"
        subtitle="Run the marketing agent with a custom prompt or the daily automated sequence."
      />
      <div className="page-content">
        <AgentConsole orgId={workspaceId} />
      </div>
    </>
  );
}
