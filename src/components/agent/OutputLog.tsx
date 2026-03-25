import * as React from "react";

interface OutputLogProps {
  logs: string[];
}

export function OutputLog({ logs }: OutputLogProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div
        className="log-output"
        style={{ color: "var(--muted-foreground)", fontStyle: "normal" }}
      >
        No output yet. Run the agent to see logs here.
      </div>
    );
  }

  return (
    <div className="log-output">
      {logs.map((line, i) => {
        const isTool = line.startsWith("[Tool]");
        const isError = line.toLowerCase().includes("error") || line.includes("[Agent] Hit max");
        return (
          <div
            key={i}
            className={isTool ? "log-tool" : isError ? "log-error" : ""}
          >
            {line}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
