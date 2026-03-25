import * as React from "react";
import { Play, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { OutputLog } from "./OutputLog";
import { toast } from "sonner";

export function AgentConsole() {
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
          mode === "daily" ? { mode: "daily" } : { mode: "custom", prompt },
        ),
      });
      const data = (await res.json()) as { ok?: boolean; logs?: string[]; error?: string };
      if (data.logs) {
        setLogs(data.logs);
      }
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Agent run complete");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Custom Prompt</div>
          <div className={`status-pill ${running ? "running" : "idle"}`}>
            <div className={`status-dot ${running ? "pulse" : ""}`} />
            {running ? "Running" : "Idle"}
          </div>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a custom instruction for the agent..."
          style={{ minHeight: 100, marginBottom: 12 }}
          disabled={running}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={() => run("custom")}
            disabled={running || !prompt.trim()}
          >
            <Play size={14} />
            Run Custom
          </Button>
          <Button
            variant="ghost"
            onClick={() => run("daily")}
            disabled={running}
          >
            <Zap size={14} />
            Run Daily
          </Button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Output Log</div>
        <OutputLog logs={logs} />
      </div>
    </div>
  );
}
