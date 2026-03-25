import * as React from "react";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return <div className="main-area">{children}</div>;
}
