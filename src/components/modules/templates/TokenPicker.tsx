import * as React from "react";

export const TOKENS = [
  { token: "{{firstName}}",  label: "First name" },
  { token: "{{lastName}}",   label: "Last name" },
  { token: "{{fullName}}",   label: "Full name" },
  { token: "{{company}}",    label: "Company" },
  { token: "{{website}}",    label: "Website" },
  { token: "{{whatTheyDo}}", label: "What they do" },
];

interface TokenPickerProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  value: string;
}

export function TokenPicker({ textareaRef, onChange, value }: TokenPickerProps) {
  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    // Restore cursor after token
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-[11px] text-muted-foreground self-center mr-1">Insert:</span>
      {TOKENS.map(({ token, label }) => (
        <button
          key={token}
          type="button"
          onClick={() => insertToken(token)}
          className="text-[11px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors font-mono"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
