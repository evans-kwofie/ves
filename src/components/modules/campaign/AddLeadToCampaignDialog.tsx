import * as React from "react";
import { Cancel01Icon, Search01Icon, CheckmarkCircle01Icon, Loading03Icon, UserAdd01Icon } from "hugeicons-react";
import { toast } from "sonner";
import { useAddLeadStore } from "~/store/add-lead-to-campaign";
import type { Lead } from "~/types/lead";

export function AddLeadToCampaignDialog() {
  const { open, campaignId, orgId, existingLeadIds, onLeadAdded, closeDialog } = useAddLeadStore();

  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [adding, setAdding] = React.useState<string | null>(null);
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());

  // Fetch org leads when dialog opens
  React.useEffect(() => {
    if (!open || !orgId) return;
    setQuery("");
    setAddedIds(new Set());
    setLoading(true);
    fetch(`/api/pipeline/leads?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data: Lead[]) => setLeads(data))
      .catch(() => toast.error("Failed to load leads"))
      .finally(() => setLoading(false));
  }, [open, orgId]);

  const alreadyInCampaign = new Set([...existingLeadIds, ...addedIds]);

  const filtered = leads.filter((l) => {
    if (alreadyInCampaign.has(l.id)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      l.company.toLowerCase().includes(q) ||
      l.ceo.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q)
    );
  });

  async function handleAdd(lead: Lead) {
    if (!campaignId) return;
    setAdding(lead.id);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error();
      setAddedIds((prev) => new Set([...prev, lead.id]));
      onLeadAdded?.(lead);
      toast.success(`${lead.company} added to campaign`);
    } catch {
      toast.error("Failed to add lead");
    } finally {
      setAdding(null);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={closeDialog} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-120 max-h-140 rounded-xl overflow-hidden flex flex-col bg-muted border border-card-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Add contact</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Select contacts from your pipeline to add to this campaign.</p>
          </div>
          <button
            onClick={closeDialog}
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <Cancel01Icon size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 px-3 h-9 rounded-md bg-card border border-card-border">
            <Search01Icon size={13} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company, name or email…"
              className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loading03Icon size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <p className="text-[13px] font-medium text-muted-foreground">
                {query ? "No matching contacts" : "All contacts are already in this campaign"}
              </p>
            </div>
          ) : (
            filtered.map((lead) => {
              const isAdding = adding === lead.id;
              return (
                <button
                  key={lead.id}
                  onClick={() => handleAdd(lead)}
                  disabled={isAdding}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card transition-colors cursor-pointer text-left disabled:opacity-60"
                >
                  <div className="size-7 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center shrink-0">
                    {lead.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{lead.company}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {lead.ceo}{lead.email ? ` · ${lead.email}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {isAdding
                      ? <Loading03Icon size={14} className="animate-spin" />
                      : <UserAdd01Icon size={14} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {addedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-card-border shrink-0">
            <CheckmarkCircle01Icon size={13} className="text-green-500" />
            <p className="text-[12px] text-muted-foreground">
              {addedIds.size} contact{addedIds.size !== 1 ? "s" : ""} added
            </p>
            <button
              onClick={closeDialog}
              className="ml-auto text-[12px] font-medium text-foreground hover:text-accent transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}
