import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "~/components/layout/Header";
import { AgentConsole } from "~/components/agent/AgentConsole";

export const Route = createFileRoute("/agent")({
  component: AgentPage,
});

function AgentPage() {
  return (
    <>
      <Header
        title="AI Agent"
        subtitle="Run the marketing agent with a custom prompt or the daily automated sequence."
      />
      <div className="page-content">
        <AgentConsole />
      </div>
    </>
  );
}
