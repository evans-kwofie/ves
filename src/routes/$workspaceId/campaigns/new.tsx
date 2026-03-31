import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/layout/Header";
import { Button } from "~/components/ui/button";
import { ArrowLeft01Icon, CheckmarkCircle01Icon, Mail01Icon, Linkedin01Icon, GlobalIcon } from "hugeicons-react";
import { listLeads } from "~/db/queries/leads";
import { toast } from "sonner";
import type { Lead } from "~/types/lead";
import type { CampaignChannel } from "~/types/campaign";

const getLeadsData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listLeads(orgId));

export const Route = createFileRoute("/$workspaceId/campaigns/new")({
  loader: ({ params }) => getLeadsData({ data: params.workspaceId }),
  component: NewCampaignPage,
});

type Step = "details" | "leads" | "review";

const FIT_BADGE: Record<string, string> = {
  HIGH: "badge badge-green",
  MEDIUM: "badge badge-yellow",
  LOW: "badge badge-red",
};

const CHANNELS: { value: CampaignChannel; label: string; icon: React.ReactNode }[] = [
  { value: "email", label: "Email", icon: <Mail01Icon size={16} /> },
  { value: "linkedin", label: "LinkedIn", icon: <Linkedin01Icon size={16} /> },
  { value: "both", label: "Both", icon: <GlobalIcon size={16} /> },
];

function NewCampaignPage() {
  const leads = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();

  const [step, setStep] = React.useState<Step>("details");
  const [name, setName] = React.useState("");
  const [channel, setChannel] = React.useState<CampaignChannel | "">("");
  const [goal, setGoal] = React.useState("");
  const [selectedLeads, setSelectedLeads] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filteredLeads = leads.filter(
    (l) =>
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.ceo.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggleLead(id: string) {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: workspaceId,
          name,
          channel: channel || undefined,
          goal: goal || undefined,
          leadIds: Array.from(selectedLeads),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Campaign created");
      navigate({ to: "/$workspaceId/campaigns", params: { workspaceId } });
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setSaving(false);
    }
  }

  const canProceedDetails = name.trim().length > 0;

  return (
    <>
      <Header
        title="New Campaign"
        subtitle="Set up an outreach sequence for a group of leads."
        actions={
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/$workspaceId/campaigns", params: { workspaceId } })}
          >
            <ArrowLeft01Icon size={14} />
            Back
          </Button>
        }
      />
      <div className="page-content" style={{ maxWidth: 680 }}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
          {(["details", "leads", "review"] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { details: "Details", leads: "Select Leads", review: "Review" };
            const done = step === "leads" ? i === 0 : step === "review" ? i < 2 : false;
            const active = step === s;
            return (
              <React.Fragment key={s}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: done ? "var(--accent)" : active ? "var(--accent)" : "var(--muted)",
                      color: done || active ? "var(--accent-foreground)" : "var(--muted-foreground)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {done ? <CheckmarkCircle01Icon size={14} /> : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--foreground)" : "var(--muted-foreground)",
                    }}
                  >
                    {labels[s]}
                  </span>
                </div>
                {i < 2 && (
                  <div style={{ flex: 1, height: 1, background: "var(--border)", margin: "0 12px", minWidth: 24 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step: Details */}
        {step === "details" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Campaign Name *</label>
              <input
                className="input"
                placeholder="e.g. Q2 SaaS Founders Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Channel</label>
              <div style={{ display: "flex", gap: 8 }}>
                {CHANNELS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(channel === c.value ? "" : c.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${channel === c.value ? "var(--accent)" : "var(--border)"}`,
                      background: channel === c.value ? "var(--accent-subtle)" : "var(--input-bg)",
                      color: channel === c.value ? "var(--accent)" : "var(--muted-foreground)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      transition: "all 0.15s",
                    }}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Goal</label>
              <textarea
                className="input"
                placeholder="What does success look like for this campaign? e.g. Book 5 discovery calls with B2B SaaS founders"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => setStep("leads")} disabled={!canProceedDetails}>
                Next: Select Leads
              </Button>
            </div>
          </div>
        )}

        {/* Step: Select Leads */}
        {step === "leads" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Select Leads</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8 }}>
                  {selectedLeads.size} selected
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 ? "Deselect All" : "Select All"}
              </button>
            </div>

            <input
              className="input"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
              {filteredLeads.length === 0 && (
                <div className="empty-state" style={{ padding: "24px 16px" }}>
                  {search ? "No leads match your search." : "No leads in pipeline yet."}
                </div>
              )}
              {filteredLeads.map((lead) => {
                const checked = selectedLeads.has(lead.id);
                return (
                  <label
                    key={lead.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      background: checked ? "var(--accent-subtle)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLead(lead.id)}
                      style={{ accentColor: "var(--accent)", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{lead.company}</span>
                        {lead.fit && <span className={FIT_BADGE[lead.fit] ?? "badge badge-gray"}>{lead.fit}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {lead.ceo} · {lead.email || "no email"}
                      </div>
                    </div>
                    {lead.score != null && (
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)", flexShrink: 0 }}>
                        {lead.score}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep("details")}>
                Back
              </button>
              <Button onClick={() => setStep("review")}>
                Next: Review
              </Button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <p className="form-label" style={{ marginBottom: 4 }}>Campaign Name</p>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{name}</p>
            </div>

            {channel && (
              <div>
                <p className="form-label" style={{ marginBottom: 4 }}>Channel</p>
                <p style={{ fontSize: 13, margin: 0, textTransform: "capitalize" }}>{channel}</p>
              </div>
            )}

            {goal && (
              <div>
                <p className="form-label" style={{ marginBottom: 4 }}>Goal</p>
                <p style={{ fontSize: 13, margin: 0, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{goal}</p>
              </div>
            )}

            <div>
              <p className="form-label" style={{ marginBottom: 8 }}>Leads ({selectedLeads.size})</p>
              {selectedLeads.size === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                  No leads selected — you can add them later.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Array.from(selectedLeads)
                    .map((id) => leads.find((l) => l.id === id))
                    .filter((l): l is Lead => !!l)
                    .slice(0, 5)
                    .map((l) => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{l.company}</span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{l.ceo}</span>
                      </div>
                    ))}
                  {selectedLeads.size > 5 && (
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
                      +{selectedLeads.size - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep("leads")}>
                Back
              </button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
