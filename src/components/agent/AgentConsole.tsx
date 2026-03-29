import * as React from "react";
import { PlayIcon, FlashIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { OutputLog } from "./OutputLog";
import { toast } from "sonner";

interface AgentConsoleProps {
  orgId: string;
}

export function AgentConsole({ orgId }: AgentConsoleProps) {
  const [prompt, setPrompt] = React.useState("");
  const [logs, setLogs] = React.useState<string[]>([]);
  const [running, setRunning] = React.useState(false);

  async function run(mode: "daily" | "custom") {
    if (mode === "custom" && !prompt.trim()) return;
    setRunning(true);
    setLogs([]);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "daily"
            ? { mode: "daily", organizationId: orgId }
            : { mode: "custom", prompt, organizationId: orgId },
        ),
      });
      const data = (await res.json()) as { ok?: boolean; logs?: string[]; error?: string };
      if (data.logs) setLogs(data.logs);
      if (data.error) toast.error(data.error);
      else toast.success("Agent run complete");
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Custom Prompt</p>
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${running ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--muted-foreground)]"}`} />
            {running ? "Running" : "Idle"}
          </div>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a custom instruction for the agent..."
          className="min-h-[100px] mb-3"
          disabled={running}
        />

        <div className="flex gap-2">
          <Button onClick={() => run("custom")} disabled={running || !prompt.trim()}>
            <PlayIcon size={14} />
            Run Custom
          </Button>
          <Button variant="ghost" onClick={() => run("daily")} disabled={running}>
            <FlashIcon size={14} />
            Run Daily
          </Button>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-[13px] font-semibold text-[var(--foreground)] mb-3">Output Log</p>
        <OutputLog logs={logs} />
      </div>
    </div>
  );
}
