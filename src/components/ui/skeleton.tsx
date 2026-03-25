import * as React from "react";
import { twMerge } from "tailwind-merge";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={twMerge("", className)}
      style={{
        background: "linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: "var(--radius)",
        height: 16,
      }}
      {...props}
    />
  );
}

export { Skeleton };
