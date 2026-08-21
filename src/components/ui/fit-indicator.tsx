import { cn } from "~/lib/utils";
import type { FitRating } from "~/types/lead";

const FILLED_BARS: Record<FitRating, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const FILL_CLASS: Record<FitRating, string> = {
  LOW: "bg-muted-foreground",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-accent",
};

interface FitIndicatorProps {
  fit?: FitRating | null;
  showLabel?: boolean;
  className?: string;
}

/** A compact, reusable three-bar indicator of ICP fit. */
export function FitIndicator({ fit, showLabel = true, className }: FitIndicatorProps) {
  if (!fit) {
    return <span className={cn("text-[11px] text-muted-foreground", className)}>—</span>;
  }

  const filledBars = FILLED_BARS[fit];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`${fit.toLowerCase()} fit`}
      title={`${fit[0]}${fit.slice(1).toLowerCase()} fit`}
    >
      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
        {[5, 8, 11].map((height, index) => (
          <span
            key={height}
            className={cn(
              "w-1 rounded-[1px]",
              index < filledBars ? FILL_CLASS[fit] : "bg-muted-foreground/20",
            )}
            style={{ height }}
          />
        ))}
      </span>
      {showLabel && <span className="text-[11px] font-semibold text-foreground">{fit[0]}{fit.slice(1).toLowerCase()}</span>}
    </span>
  );
}
