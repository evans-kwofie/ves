import * as React from "react"
import { cn } from "~/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  size?: "sm" | "md"
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "py-14 gap-3" : "py-6 gap-2",
        className,
      )}
    >
      {icon && (
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center mb-1 [&_svg]:size-[18px] text-muted-foreground">
          {icon}
        </div>
      )}
      <p className={cn("font-semibold text-foreground", size === "md" ? "text-[13px]" : "text-[12px]")}>
        {title}
      </p>
      {description && (
        <p className="text-[12px] text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
