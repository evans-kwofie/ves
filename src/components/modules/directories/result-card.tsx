import * as React from "react";
import {
  Add01Icon,
  CheckmarkCircle01Icon,
  Globe02Icon,
  ArrowUpRight01Icon,
  NewTwitterIcon,
  Linkedin01Icon,
} from "hugeicons-react";
import { ResultState } from "./types";

export function ResultCard({
  result,
  onAdd,
  index = 0,
}: {
  result: ResultState;
  onAdd: () => void;
  index?: number;
}) {
  const { data, status } = result;
  const socialUrl = data.linkedinHint
    ? data.linkedinHint.startsWith("http")
      ? data.linkedinHint
      : `https://linkedin.com/in/${data.linkedinHint}`
    : null;
  const isTwitter =
    socialUrl?.includes("twitter.com") || socialUrl?.includes("x.com");

  return (
    <div
      className="card p-4 flex flex-col gap-2 card-enter"
      style={{ "--card-i": index } as React.CSSProperties}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">
            {data.company}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {data.founderName ?? (
              <span style={{ fontStyle: "italic" }}>Founder not found</span>
            )}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {status === "enriching" && (
            <>
              <span className="spinner" />
              <span className="text-[10px] text-muted-foreground">
                Enriching
              </span>
            </>
          )}
          {status === "saved" && (
            <CheckmarkCircle01Icon size={16} className="text-accent status-enter" />
          )}
          {status === "duplicate" && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full status-enter">
              Duplicate
            </span>
          )}
          {status === "saving" && <span className="spinner" />}
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-[var(--muted-foreground)] leading-snug line-clamp-2">
        {data.whatTheyDo}
      </p>

      {/* Email */}
      <div
        style={{
          fontSize: 11,
          color: data.email ? "var(--foreground)" : "var(--muted-foreground)",
          fontStyle: data.email ? "normal" : "italic",
        }}
      >
        {data.email ? data.email : "No email found"}
      </div>

      {/* Launch date */}
      {data.launchedAt && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          Launched {data.launchedAt}
        </div>
      )}

      {/* Links + action */}
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {data.website && (
          <a
            href={
              data.website.startsWith("http")
                ? data.website
                : `https://${data.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            <Globe02Icon size={11} />
            Website
          </a>
        )}
        {socialUrl && (
          <a
            href={socialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            {isTwitter ? (
              <NewTwitterIcon size={11} />
            ) : (
              <Linkedin01Icon size={11} />
            )}
            {isTwitter ? "Twitter" : "LinkedIn"}
          </a>
        )}
        {data.directoryUrl && (
          <a
            href={data.directoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--accent)] flex items-center gap-1 no-underline"
          >
            <ArrowUpRight01Icon size={11} />
            Listing
          </a>
        )}
        {(status === "idle" || status === "enriching") && (
          <button
            className="btn btn-ghost btn-sm ml-auto"
            onClick={onAdd}
            disabled={status === "enriching"}
          >
            <Add01Icon size={11} />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
