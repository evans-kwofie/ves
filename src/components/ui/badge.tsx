import * as React from "react";
import { twMerge } from "tailwind-merge";

type BadgeVariant = "default" | "green" | "yellow" | "red" | "blue" | "purple";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantMap: Record<BadgeVariant, string> = {
  default: "badge-gray",
  green: "badge-green",
  yellow: "badge-yellow",
  red: "badge-red",
  blue: "badge-blue",
  purple: "badge-purple",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={twMerge("badge", variantMap[variant], className)}
      {...props}
    />
  );
}

export { Badge };
