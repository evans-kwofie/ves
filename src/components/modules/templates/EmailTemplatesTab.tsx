import * as React from "react";
import { FileEditIcon } from "hugeicons-react";

export function EmailTemplatesTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <FileEditIcon size={28} className="text-muted-foreground opacity-40" />
      <p className="text-[13px] font-medium text-foreground">
        Email templates coming soon
      </p>
      <p className="text-[12px] text-muted-foreground max-w-xs">
        Save reusable message structures for different outreach scenarios — cold
        intro, follow-up, case study pitch, and more.
      </p>
    </div>
  );
}
