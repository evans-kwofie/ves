import { Mail01Icon } from "hugeicons-react";
import { EmptyState } from "~/components/ui/empty-state";
import type { CampaignDraft } from "~/db/queries/drafts";
import type { CampaignStep } from "~/db/queries/steps";
import type { Lead } from "~/types/lead";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export function ResultsTab({
  sent,
  skipped,
  leads,
  steps,
}: {
  sent: CampaignDraft[];
  skipped: CampaignDraft[];
  leads: Lead[];
  steps: CampaignStep[];
}) {
  console.log("[leads data]", leads);
  console.log("[sent data]", sent);
  if (sent.length === 0 && skipped.length === 0) {
    return (
      <EmptyState
        icon={<Mail01Icon />}
        title="No messages sent yet"
        description="Approve drafts in the Review Queue to start sending."
      />
    );
  }

  const sentByLead = new Map<string, CampaignDraft[]>();
  for (const d of sent) {
    if (!sentByLead.has(d.leadId)) sentByLead.set(d.leadId, []);
    sentByLead.get(d.leadId)!.push(d);
  }

  const contactedLeads = leads.filter((l) => sentByLead.has(l.id));
  // console.log("contacted leads", contactedLeads);
  const repliedCount = contactedLeads.filter((l) => l.repliedAt != null).length;
  const openedCount = sent.filter((d) => d.openedAt != null).length;
  const clickedCount = sent.filter((d) => d.clickedAt != null).length;
  const replyRate =
    contactedLeads.length > 0
      ? Math.round((repliedCount / contactedLeads.length) * 100)
      : 0;
  const openRate =
    sent.length > 0 ? Math.round((openedCount / sent.length) * 100) : 0;

  // Attribute an A/B outcome to each lead's first sent test exposure. A later
  // follow-up may use a different variant, but must not double-count the reply.
  const firstSentByLead = new Map<string, CampaignDraft>();
  for (const draft of sent) {
    const current = firstSentByLead.get(draft.leadId);
    if (!current || new Date(draft.sentAt ?? 0).getTime() < new Date(current.sentAt ?? 0).getTime()) {
      firstSentByLead.set(draft.leadId, draft);
    }
  }
  const firstTestExposures = Array.from(firstSentByLead.values());
  const sentA = firstTestExposures.filter((d) => d.abVariant === "a");
  const sentB = firstTestExposures.filter((d) => d.abVariant === "b");
  const showAB = sentA.length > 0 && sentB.length > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* A/B breakdown */}
      {showAB && <ABSection sentA={sentA} sentB={sentB} leads={leads} />}

      {/* Per-lead rows */}
      {contactedLeads.map((lead, i) => {
        const leadDrafts = sentByLead.get(lead.id) ?? [];
        const sentStepNums = new Set(leadDrafts.map((d) => d.stepNumber));
        const anyOpened = leadDrafts.some((d) => d.openedAt != null);
        const anyClicked = leadDrafts.some((d) => d.clickedAt != null);
        const variant = leadDrafts[0]?.abVariant;
        const lastSent = leadDrafts
          .filter((d) => d.sentAt)
          .sort(
            (a, b) =>
              new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime(),
          )[0];

        return (
          <div
            key={lead.id}
            className={`flex items-center gap-3 py-3 ${i !== contactedLeads.length - 1 ? "border-b border-border" : ""}`}
          >
            {/* Lead info */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-semibold leading-tight">
                {lead.company}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {lead.ceo}
                {lead.email ? ` · ${lead.email}` : ""}
              </span>
            </div>

            {/* A/B variant badge */}
            {showAB && variant && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${variant === "a" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"}`}
              >
                {variant.toUpperCase()}
              </span>
            )}

            {/* Step dots */}
            <div className="flex items-center gap-1 shrink-0">
              {steps.map((s) => (
                <span
                  key={s.id}
                  title={`Step ${s.stepNumber}`}
                  className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold w-5 h-5 ${
                    sentStepNums.has(s.stepNumber)
                      ? "bg-accent text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.stepNumber}
                </span>
              ))}
            </div>

            {/* Engagement indicators */}
            <div className="flex items-center gap-1.5 shrink-0">
              {anyOpened && (
                <span className="badge badge-blue text-[10px]">Opened</span>
              )}
              {anyClicked && (
                <span className="badge badge-blue text-[10px]">Clicked</span>
              )}
            </div>

            {/* Last sent */}
            <span className="text-[11px] text-muted-foreground shrink-0 w-28 text-right">
              {lastSent?.sentAt ? fmtDate(lastSent.sentAt) : "—"}
            </span>

            {/* Reply status */}
            <div className="shrink-0 w-16 flex justify-end">
              {lead.repliedAt ? (
                <span className="badge badge-green">Replied</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Waiting
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ABSection({
  sentA,
  sentB,
  leads,
}: {
  sentA: CampaignDraft[];
  sentB: CampaignDraft[];
  leads: Lead[];
}) {
  function metrics(drafts: CampaignDraft[]) {
    const leadIds = new Set(drafts.map((d) => d.leadId));
    const contactedLeads = leads.filter((l) => leadIds.has(l.id));
    const replies = contactedLeads.filter((l) => l.repliedAt != null).length;
    const opens = drafts.filter((d) => d.openedAt != null).length;
    const replyRate =
      contactedLeads.length > 0
        ? Math.round((replies / contactedLeads.length) * 100)
        : 0;
    const openRate =
      drafts.length > 0 ? Math.round((opens / drafts.length) * 100) : 0;
    return { sent: drafts.length, replies, opens, replyRate, openRate };
  }

  const a = metrics(sentA);
  const b = metrics(sentB);
  const aWins = a.replyRate > b.replyRate;
  const bWins = b.replyRate > a.replyRate;
  const tied = a.replyRate === b.replyRate;

  return (
    <div className="mb-4 p-4 rounded-xl border border-card-border bg-card">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        A/B Test results
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["a", a, aWins],
            ["b", b, bWins],
          ] as const
        ).map(([label, m, wins]) => (
          <div
            key={label}
            className={`p-3 rounded-lg border ${wins && !tied ? "border-accent/40 bg-accent/5" : "border-border bg-muted/30"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${label === "a" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"}`}
              >
                Variant {label.toUpperCase()}
              </span>
              {wins && !tied && (
                <span className="text-[10px] font-semibold text-accent">
                  Winning
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Row label="Sent" value={m.sent} />
              <Row
                label="Open rate"
                value={`${m.openRate}%`}
                highlight={m.openRate > 0}
              />
              <Row
                label="Reply rate"
                value={`${m.replyRate}%`}
                highlight={m.replyRate > 0}
              />
            </div>
          </div>
        ))}
      </div>
      {tied && a.replyRate === 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          No replies yet — winner will appear once leads start responding.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={`text-[12px] font-semibold ${highlight ? "text-accent" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-[24px] font-bold tracking-tight leading-none ${accent ? "text-accent" : ""}`}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-7 w-px bg-border shrink-0" />;
}
