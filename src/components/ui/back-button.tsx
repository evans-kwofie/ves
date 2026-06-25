import { Link } from "@tanstack/react-router";
import { ArrowLeft01Icon } from "hugeicons-react";

interface BackButtonProps {
  to: string;
  params?: Record<string, string>;
  label?: string;
}

export function BackButton({ to, params, label = "Back" }: BackButtonProps) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      style={{ textDecoration: "none" }}
    >
      <ArrowLeft01Icon size={13} />
      {label}
    </Link>
  );
}
