import { UserAdd01Icon } from "hugeicons-react";
import { EmptyState } from "~/components/ui/empty-state";
import { FitIndicator } from "~/components/ui/fit-indicator";
import type { Lead } from "~/types/lead";
import type { CampaignDraft } from "~/db/queries/drafts";

export function LeadsTab({ leads, drafts }: { leads: Lead[]; drafts: CampaignDraft[] }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<UserAdd01Icon />}
        title="No leads yet"
        description="Add leads to this campaign to start generating outreach."
      />
    );
  }

  const draftMap = new Map(drafts.map((d) => [d.leadId, d]));

  return (
    <div className="card p-0 overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Fit</th>
            <th>Draft Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const draft = draftMap.get(lead.id);
            return (
              <tr key={lead.id}>
                <td className="font-semibold">{lead.company}</td>
                <td className="text-muted-foreground">{lead.ceo}</td>
                <td className="text-muted-foreground text-[12px]">{lead.email || "—"}</td>
                <td>
                  <FitIndicator fit={lead.fit} />
                </td>
                <td>
                  {!draft && <span className="badge badge-gray">No draft</span>}
                  {draft?.status === "pending" && <span className="badge badge-blue">Pending</span>}
                  {draft?.status === "sent" && <span className="badge badge-green">Sent</span>}
                  {draft?.status === "skipped" && <span className="badge badge-gray">Skipped</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
