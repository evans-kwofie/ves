import * as React from "react";
import type { Template } from "~/db/queries/templates";

interface TemplatePreviewProps {
  template: Pick<Template, "subject" | "body" | "channel" | "brandColor" | "showLogo">;
  orgName?: string;
  orgLogo?: string | null;
  signerName?: string;
}

const SAMPLE: Record<string, string> = {
  "{{firstName}}":  "Sarah",
  "{{lastName}}":   "Chen",
  "{{fullName}}":   "Sarah Chen",
  "{{company}}":    "Acme Corp",
  "{{website}}":    "acmecorp.com",
  "{{whatTheyDo}}": "enterprise software for logistics teams",
};

function resolve(text: string) {
  return Object.entries(SAMPLE).reduce(
    (t, [token, val]) => t.replaceAll(token, val),
    text,
  );
}

export function TemplatePreview({ template, orgName, orgLogo, signerName }: TemplatePreviewProps) {
  const accent = template.brandColor ?? "var(--accent)";
  const isEmail = template.channel === "email";
  const hasHeader = isEmail && template.showLogo && (orgLogo || orgName);

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden shadow-sm">
      {/* Logo header */}
      {hasHeader && (
        <div className="px-8 py-5 border-b border-border">
          {orgLogo
            ? <img src={orgLogo} alt={orgName} className="h-7 object-contain" />
            : <span className="text-[15px] font-semibold" style={{ color: accent }}>{orgName}</span>
          }
        </div>
      )}

      {/* Top accent bar */}
      {isEmail && (
        <div className="h-0.5 w-full" style={{ background: accent }} />
      )}

      {/* Body */}
      <div className="px-8 py-7">
        {isEmail && template.subject && (
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: accent }}>
            {resolve(template.subject)}
          </p>
        )}

        <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
          {resolve(template.body) || (
            <span className="text-muted-foreground">Your message will appear here…</span>
          )}
        </div>

        {/* Signature */}
        {isEmail && signerName && (
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[12px] text-muted-foreground">
              Best,<br />
              <span className="font-medium text-foreground">{signerName}</span>
              {orgName && (
                <><br /><span className="text-muted-foreground">{orgName}</span></>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
      {isEmail && (
        <div className="h-1 w-full opacity-15" style={{ background: accent }} />
      )}
    </div>
  );
}
