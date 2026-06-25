import * as React from "react";
import { EyeIcon, ViewOffSlashIcon } from "hugeicons-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "type"> {}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <ViewOffSlashIcon size={14} /> : <EyeIcon size={14} />}
      </button>
    </div>
  );
}
