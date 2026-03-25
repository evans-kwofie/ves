import * as React from "react";
import { twMerge } from "tailwind-merge";

interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

function Separator({ className, ...props }: SeparatorProps) {
  return <hr className={twMerge("divider", className)} {...props} />;
}

export { Separator };
