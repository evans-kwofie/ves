import { Button } from "~/components/ui/button";
import { FitIndicator } from "~/components/ui/fit-indicator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import type { Lead } from "~/types/lead";
import { timeAgo } from "~/utils/date";

interface OutreachEvent {
  id: string;
  channel: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

interface EnrichmentAttempt {
  id: string;
  attemptNumber: number;
  status: "succeeded" | "retrying" | "failed";
  summary: string | null;
  error: string | null;
  createdAt: string;
}

const channelLabel: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  reply: "Reply",
  deal: "Deal",
};

function outcomeLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const validationItems = (lead: Lead) => [
  ["Company", lead.companyValid],
  ["Contact", lead.personValid],
  ["Website/profile", lead.websiteValid],
] as const;

export function LeadDetailsSheet({
  open,
  onOpenChange,
  lead,
  events,
  enrichmentAttempts,
  loading,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  events: OutreachEvent[];
  enrichmentAttempts: EnrichmentAttempt[];
  loading: boolean;
  onEdit: () => void;
}) {
  const failedEnrichment = lead.pipelineStage === "enrichment_failed" || lead.pipelineStage === "failed" || lead.enrichmentAttempts >= 3;
  const missingRequirements = [
    lead.company.trim().length < 2 ? "a company name" : null,
    !/^https?:\/\//i.test(lead.website.trim()) ? "a valid website or profile URL" : null,
    !lead.email.trim() && !lead.linkedin.trim() && lead.source !== "instagram" ? "an email or LinkedIn URL" : null,
  ].filter((requirement): requirement is string => Boolean(requirement));
  const needsManualDetails = failedEnrichment && missingRequirements.length > 0;



  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:min-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{lead.company}</SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            {lead.ceo || "No contact identified yet"}
            {lead.source ? ` · ${lead.source}` : ""}
          </p>
        </SheetHeader>

        {loading ? (
          <p className="p-4 text-[12px] text-muted-foreground">Loading lead details…</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-6">
              {needsManualDetails && (
                <section className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3">
                  <p className="text-[12px] font-semibold text-amber-400">This lead needs your input</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-foreground">
                    We could not verify enough detail after {lead.enrichmentAttempts} enrichment attempts. Add {missingRequirements.join(" and ")}, then run enrichment again.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={onEdit}>Add details</Button>
                </section>
              )}

              <section className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Enrichment result</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <FitIndicator fit={lead.fit} showLabel />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">{lead.score == null ? "Not scored" : `${lead.score}/100`}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{lead.pipelineStage}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground">{lead.fitReason ?? "No ICP rationale has been generated yet."}</p>
                {Object.keys(lead.scoreBreakdown).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[11px]">
                    {Object.entries(lead.scoreBreakdown).map(([factor, points]) => (
                      <div key={factor} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span className="capitalize">{factor.replace(/([A-Z])/g, " $1")}</span>
                        <span className="font-medium text-foreground">{points} pts</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Checked company context, website/profile, available contact channels, and alignment with your workspace ICP.</p>
                {lead.email && lead.emailVerificationStatus && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Email: <span className="font-medium text-foreground">{lead.emailVerificationStatus === "verified" ? "Verified" : lead.emailVerificationStatus === "accept_all" ? "Accept-all domain" : "Not verified"}</span>
                    {lead.emailVerificationConfidence != null && ` · ${lead.emailVerificationConfidence}% confidence`}
                    {lead.emailVerifiedAt && ` · checked ${timeAgo(lead.emailVerifiedAt)}`}
                  </p>
                )}
              </section>

              {lead.engagementHistory.length > 0 && <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recent public context</p>
                <div className="mt-2 flex flex-col gap-2">
                  {lead.engagementHistory.map((signal, index) => {
                    const summary = typeof signal.summary === "string" ? signal.summary : null;
                    const sourceUrl = typeof signal.sourceUrl === "string" ? signal.sourceUrl : null;
                    const publishedAt = typeof signal.publishedAt === "string" ? signal.publishedAt : null;
                    if (!summary) return null;
                    return <div key={sourceUrl ?? `${summary}-${index}`} className="rounded-md border border-border bg-muted/20 p-3">
                      <p className="text-[12px] leading-relaxed text-foreground">{summary}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">View source</a>}
                        {publishedAt && <span>{publishedAt}</span>}
                      </div>
                    </div>;
                  })}
                </div>
              </section>}

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Enrichment history</p>
                {enrichmentAttempts.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">No enrichment attempts recorded yet.</p> : (
                  <div className="mt-2 flex flex-col gap-2">
                    {enrichmentAttempts.map((attempt) => <div key={attempt.id} className="rounded-md border border-border p-2 text-[12px]">
                      <div className="flex items-center justify-between"><span>Attempt {attempt.attemptNumber} · {attempt.status}</span><span className="text-muted-foreground">{timeAgo(attempt.createdAt)}</span></div>
                      <p className="mt-1 text-muted-foreground">{attempt.summary ?? attempt.error ?? "No details recorded."}</p>
                    </div>)}
                  </div>
                )}
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contact and company</p>
                <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[12px]">
                  <dt className="text-muted-foreground">Contact</dt><dd>{lead.ceo || "Not found"}</dd>
                  <dt className="text-muted-foreground">Email</dt><dd>{lead.email || "Not found"}</dd>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd className="truncate">{lead.website ? <a className="text-accent hover:underline" href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : "Not found"}</dd>
                  <dt className="text-muted-foreground">LinkedIn</dt>
                  <dd className="truncate">{lead.linkedin ? <a className="text-accent hover:underline" href={lead.linkedin} target="_blank" rel="noreferrer">{lead.linkedin}</a> : "Not found"}</dd>
                  <dt className="text-muted-foreground">What they do</dt><dd>{lead.whatTheyDo || "Not found"}</dd>
                  {lead.role && <><dt className="text-muted-foreground">Role</dt><dd>{lead.role}</dd></>}
                  {lead.industry && <><dt className="text-muted-foreground">Industry</dt><dd>{lead.industry}</dd></>}
                  {lead.companySize && <><dt className="text-muted-foreground">Company size</dt><dd>{lead.companySize}</dd></>}
                  {lead.location && <><dt className="text-muted-foreground">Location</dt><dd>{lead.location}</dd></>}
                </dl>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Validation</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {validationItems(lead).map(([label, valid]) => (
                    <span key={label} className={`rounded-full px-2 py-0.5 ${valid === true ? "bg-emerald-500/10 text-emerald-400" : valid === false ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground"}`}>
                      {label}: {valid === true ? "verified" : valid === false ? "needs work" : "unchecked"}
                    </span>
                  ))}
                </div>
                {lead.validationErrors.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-red-400">
                    {lead.validationErrors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </section>

              {lead.notes && <section><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</p><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{lead.notes}</p></section>}

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prospect timeline</p>
                {events.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">No outreach recorded yet.</p> : (
                  <div className="mt-3 flex flex-col">
                    {events.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < events.length - 1 && <span className="absolute left-[5px] top-3 h-[calc(100%-4px)] w-px bg-border" />}
                      <span className={`relative mt-1 size-2.5 shrink-0 rounded-full ${event.status === "sent" ? "bg-accent" : event.status === "unsubscribed" || event.status === "objection" ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-[12px]">
                          <span className="font-medium text-foreground">{channelLabel[event.channel] ?? event.channel} · {outcomeLabel(event.status)}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(event.sentAt ?? event.repliedAt)}</span>
                        </div>
                        {event.campaignName && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.campaignName}</p>}
                      </div>
                    </div>)}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        <SheetFooter className="border-t bg-muted/30 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onEdit}>Edit lead</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
