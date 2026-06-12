import * as React from "react";

interface Stat {
  label: string;
  value: string | number;
  accent?: boolean;
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex items-center gap-6 pb-5 mb-2 border-b border-border flex-wrap">
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <div className="h-7 w-px bg-border shrink-0" />}
          <div>
            <div className={`text-[26px] font-bold tracking-tight leading-none ${s.accent ? "text-accent" : ""}`}>
              {s.value}
            </div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
