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
  if (sent.length === 0 && skipped.length === 0) {
    return (
      <div className="empty-state">
        No messages sent yet. Approve drafts in the Review Queue to start sending.
      </div>
    );
  }

  const sentByLead = new Map<string, CampaignDraft[]>();
  for (const d of sent) {
    if (!sentByLead.has(d.leadId)) sentByLead.set(d.leadId, []);
    sentByLead.get(d.leadId)!.push(d);
  }

  const contactedLeads = leads.filter((l) => sentByLead.has(l.id));
  const repliedCount = contactedLeads.filter((l) => l.repliedAt != null).length;
  const replyRate =
    contactedLeads.length > 0
      ? Math.round((repliedCount / contactedLeads.length) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[12px] text-muted-foreground mb-3">
        {sent.length} message{sent.length !== 1 ? "s" : ""} sent to{" "}
        {contactedLeads.length} lead{contactedLeads.length !== 1 ? "s" : ""}
        {repliedCount > 0
          ? ` · ${repliedCount} repl${repliedCount !== 1 ? "ies" : "y"} (${replyRate}%)`
          : ""}
        {skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
      </p>

      {contactedLeads.map((lead, i) => {
        const leadDrafts = sentByLead.get(lead.id) ?? [];
        const sentStepNums = new Set(leadDrafts.map((d) => d.stepNumber));
        const lastSent = leadDrafts
          .filter((d) => d.sentAt)
          .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())[0];

        return (
          <div
            key={lead.id}
            className={`flex items-center gap-3 py-3 ${i !== contactedLeads.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-semibold leading-tight">{lead.company}</span>
              <span className="text-[11px] text-muted-foreground">
                {lead.ceo}
                {lead.email ? ` · ${lead.email}` : ""}
              </span>
            </div>

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

            <span className="text-[11px] text-muted-foreground shrink-0 w-28 text-right">
              {lastSent?.sentAt ? fmtDate(lastSent.sentAt) : "—"}
            </span>

            <div className="shrink-0 w-16 flex justify-end">
              {lead.repliedAt ? (
                <span className="badge badge-green">Replied</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Waiting</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
