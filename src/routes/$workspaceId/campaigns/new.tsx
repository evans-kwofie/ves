import * as React from "react";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { Header } from "~/components/templates/Header";
import { Button } from "~/components/ui/button";
import {
  CheckmarkCircle01Icon,
  UserGroupIcon,
  FilterIcon,
} from "hugeicons-react";
import { EmptyState } from "~/components/ui/empty-state";
import { listLeads } from "~/db/queries/leads";
import { getCampaign, getCampaignLeadIds } from "~/db/queries/campaigns";
import { toast } from "sonner";
import type { Lead } from "~/types/lead";
import type { CampaignIntent } from "~/types/campaign";
import { CHANNEL_LIST, CHANNEL_META } from "~/lib/channels";
import type { Channel } from "~/lib/channels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";

const getLeadsData = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: orgId }) => listLeads(orgId));

const getCampaignForEdit = createServerFn({ method: "GET" })
  .inputValidator(z.object({ orgId: z.string(), campaignId: z.string() }))
  .handler(async ({ data }) => {
    const [campaign, leadIds] = await Promise.all([
      getCampaign(data.campaignId),
      getCampaignLeadIds(data.campaignId),
    ]);
    if (!campaign || campaign.organizationId !== data.orgId) return null;
    return { campaign, leadIds };
  });

export const Route = createFileRoute("/$workspaceId/campaigns/new")({
  validateSearch: z.object({
    leadIds: z.string().optional(),
    campaignId: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ campaignId: search.campaignId }),
  loader: async ({ params, deps }) => {
    const { campaignId } = deps;
    const [leads, existing] = await Promise.all([
      getLeadsData({ data: params.workspaceId }),
      campaignId
        ? getCampaignForEdit({
            data: { orgId: params.workspaceId, campaignId },
          })
        : Promise.resolve(null),
    ]);
    return { leads, existing };
  },
  component: NewCampaignPage,
});

type Step = "details" | "leads" | "review";

const FIT_BADGE: Record<string, string> = {
  HIGH: "badge badge-green",
  MEDIUM: "badge badge-yellow",
  LOW: "badge badge-red",
};

const INTENTS: { value: CampaignIntent; label: string; description: string }[] =
  [
    {
      value: "advice_seeking",
      label: "Advice seeking",
      description: "Ask for their opinion or expertise — no pitch",
    },
    {
      value: "product_review",
      label: "Product review",
      description: "Ask them to try or review the product",
    },
    {
      value: "audit_offer",
      label: "Audit offer",
      description: "Lead with a free audit or analysis upfront",
    },
    {
      value: "direct_pitch",
      label: "Direct pitch",
      description: "Clear value prop with a demo ask",
    },
  ];

function NewCampaignPage() {
  const { leads, existing } = Route.useLoaderData();
  const { workspaceId } = Route.useParams();
  const { leadIds: leadIdsParam, campaignId: editingId } = useSearch({
    from: "/$workspaceId/campaigns/new",
  });
  const navigate = useNavigate();
  const isEditing = !!editingId;

  const preselected = React.useMemo(() => {
    if (existing) return new Set(existing.leadIds);
    return new Set(leadIdsParam ? leadIdsParam.split(",").filter(Boolean) : []);
  }, [existing, leadIdsParam]);

  const [step, setStep] = React.useState<Step>("details");
  const [name, setName] = React.useState(existing?.campaign.name ?? "");
  const [channels, setChannels] = React.useState<Channel[]>(
    existing?.campaign.channels ?? [],
  );
  const [goal, setGoal] = React.useState(existing?.campaign.goal ?? "");
  const [intentType, setIntentType] = React.useState<CampaignIntent | "">(
    existing?.campaign.intentType ?? "",
  );
  const [batchSize, setBatchSize] = React.useState(existing?.campaign.batchSize ?? 25);
  const [timezone, setTimezone] = React.useState(existing?.campaign.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [sendWindowStart, setSendWindowStart] = React.useState(existing?.campaign.sendWindowStart ?? 8);
  const [sendWindowEnd, setSendWindowEnd] = React.useState(existing?.campaign.sendWindowEnd ?? 18);
  const [weekdaysOnly, setWeekdaysOnly] = React.useState(existing?.campaign.weekdaysOnly ?? true);
  const [scheduledStartAt, setScheduledStartAt] = React.useState(existing?.campaign.scheduledStartAt ? existing.campaign.scheduledStartAt.slice(0, 16) : "");
  const [channelSendRules, setChannelSendRules] = React.useState<Record<string, { maxPerDay?: number; windowStart?: number; windowEnd?: number; weekdaysOnly?: boolean }>>((existing?.campaign.channelSendRules ?? {}) as Record<string, { maxPerDay?: number; windowStart?: number; windowEnd?: number; weekdaysOnly?: boolean }>);
  const [selectedLeads, setSelectedLeads] =
    React.useState<Set<string>>(preselected);

  // Sync form state when loader data arrives (handles client-side navigation)
  React.useEffect(() => {
    if (existing) {
      setName(existing.campaign.name);
      setChannels(existing.campaign.channels);
      setGoal(existing.campaign.goal ?? "");
      setIntentType(existing.campaign.intentType ?? "");
      setBatchSize(existing.campaign.batchSize);
      setTimezone(existing.campaign.timezone);
      setSendWindowStart(existing.campaign.sendWindowStart);
      setSendWindowEnd(existing.campaign.sendWindowEnd);
      setWeekdaysOnly(existing.campaign.weekdaysOnly);
      setScheduledStartAt(existing.campaign.scheduledStartAt ? existing.campaign.scheduledStartAt.slice(0, 16) : "");
      setChannelSendRules(existing.campaign.channelSendRules as Record<string, { maxPerDay?: number; windowStart?: number; windowEnd?: number; weekdaysOnly?: boolean }>);
      setSelectedLeads(new Set(existing.leadIds));
    }
  }, [existing]);
  const [search, setSearch] = React.useState("");
  const [fitFilter, setFitFilter] = React.useState<
    "all" | "HIGH" | "MEDIUM" | "LOW"
  >("all");
  const [scoreSort, setScoreSort] = React.useState<"default" | "asc" | "desc">(
    "default",
  );
  const [saving, setSaving] = React.useState(false);

  const filteredLeads = React.useMemo(() => {
    let result = leads.filter(
      (l) =>
        l.company.toLowerCase().includes(search.toLowerCase()) ||
        l.ceo.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase()),
    );
    if (fitFilter !== "all") result = result.filter((l) => l.fit === fitFilter);
    if (scoreSort === "desc")
      result = [...result].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (scoreSort === "asc")
      result = [...result].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    return result;
  }, [leads, search, fitFilter, scoreSort]);

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

  async function handleSave() {
    setSaving(true);
    try {
      if (isEditing && editingId) {
        const res = await fetch(`/api/campaigns/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            channels: channels.length ? channels : [],
            goal: goal || null,
            intentType: intentType || null,
            batchSize, timezone, sendWindowStart, sendWindowEnd, weekdaysOnly, channelSendRules, scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
            leadIds: Array.from(selectedLeads),
          }),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success("Campaign updated");
        navigate({
          to: "/$workspaceId/campaigns/$id",
          params: { workspaceId, id: editingId },
        });
      } else {
        const res = await fetch("/api/campaigns/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: workspaceId,
            name,
            channels: channels.length ? channels : undefined,
            goal: goal || undefined,
            intentType: intentType || undefined,
            batchSize, timezone, sendWindowStart, sendWindowEnd, weekdaysOnly, channelSendRules, scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
            leadIds: Array.from(selectedLeads),
          }),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success("Campaign created");
        navigate({ to: "/$workspaceId/campaigns", params: { workspaceId } });
      }
    } catch {
      toast.error(
        isEditing ? "Failed to update campaign" : "Failed to create campaign",
      );
    } finally {
      setSaving(false);
    }
  }

  const canProceedDetails = name.trim().length > 0;

  return (
    <>
      <Header
        title={isEditing ? "Edit Campaign" : "New Campaign"}
        subtitle={
          isEditing
            ? "Update your campaign details and leads."
            : "Set up an outreach sequence for a group of leads."
        }
      />
      <div className="page-content" style={{ maxWidth: 680 }}>
        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            marginBottom: 28,
          }}
        >
          {(["details", "leads", "review"] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              details: "Details",
              leads: "Select Leads",
              review: "Review",
            };
            const done =
              step === "leads" ? i === 0 : step === "review" ? i < 2 : false;
            const active = step === s;
            return (
              <React.Fragment key={s}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: done
                        ? "var(--accent)"
                        : active
                          ? "var(--accent)"
                          : "var(--muted)",
                      color:
                        done || active
                          ? "var(--accent-foreground)"
                          : "var(--muted-foreground)",
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
                      color: active
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {labels[s]}
                  </span>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--border)",
                      margin: "0 12px",
                      minWidth: 24,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step: Details */}
        {step === "details" && (
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <div className="flex flex-col gap-y-2" style={{ margin: 0 }}>
              <Label>Campaign Name *</Label>
              <Input
                placeholder="e.g. Q2 SaaS Founders Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Channels</label>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  marginBottom: 8,
                  marginTop: 2,
                }}
              >
                Select all channels this campaign will use. Sequence steps will
                only show these options.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CHANNEL_LIST.map((c) => {
                  const { label, Icon } = CHANNEL_META[c];
                  const selected = channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setChannels((prev) =>
                          prev.includes(c)
                            ? prev.filter((x) => x !== c)
                            : [...prev, c],
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: "var(--radius)",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected
                          ? "var(--accent-subtle)"
                          : "var(--input-bg)",
                        color: selected
                          ? "var(--accent)"
                          : "var(--muted-foreground)",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                        transition: "all 0.15s",
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 border-t pt-5">
              <div><Label>Sending rules</Label><p className="mt-1 text-xs text-muted-foreground">Applied when sending email steps in this campaign.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Daily batch size</Label><Input type="number" min={1} max={500} value={batchSize} onChange={(event) => setBatchSize(Math.max(1, Number(event.target.value) || 1))} /></div>
                <div className="space-y-2"><Label>Timezone</Label><Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="America/New_York" /></div>
                <div className="space-y-2"><Label>Send from (hour)</Label><Input type="number" min={0} max={23} value={sendWindowStart} onChange={(event) => setSendWindowStart(Math.max(0, Math.min(23, Number(event.target.value) || 0)))} /></div>
                <div className="space-y-2"><Label>Send until (hour)</Label><Input type="number" min={1} max={24} value={sendWindowEnd} onChange={(event) => setSendWindowEnd(Math.max(1, Math.min(24, Number(event.target.value) || 1)))} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={weekdaysOnly} onCheckedChange={(checked) => setWeekdaysOnly(Boolean(checked))} /> Weekdays only</label>
              <div className="space-y-2"><Label>Start exactly at (optional)</Label><Input type="datetime-local" value={scheduledStartAt} onChange={(event) => setScheduledStartAt(event.target.value)} /><p className="text-xs text-muted-foreground">The campaign will not generate or send before this time.</p></div>
              {channels.length > 0 && <div className="space-y-3 rounded-md border p-3"><Label>Per-channel overrides</Label>{channels.map((channel) => { const rule = channelSendRules[channel] ?? {}; return <div className="grid grid-cols-3 gap-2" key={channel}><span className="self-center text-sm capitalize">{channel}</span><Input type="number" min={1} placeholder="Daily cap" value={rule.maxPerDay ?? ""} onChange={(event) => setChannelSendRules((rules) => ({ ...rules, [channel]: { ...rule, maxPerDay: event.target.value ? Number(event.target.value) : undefined } }))} /><label className="flex items-center gap-2 text-xs"><Checkbox checked={rule.weekdaysOnly ?? weekdaysOnly} onCheckedChange={(checked) => setChannelSendRules((rules) => ({ ...rules, [channel]: { ...rule, weekdaysOnly: Boolean(checked) } }))} />Weekdays only</label></div>; })}<p className="text-xs text-muted-foreground">Leave the daily cap empty to use the campaign batch limit. Each channel can also inherit the campaign time window.</p></div>}
            </div>

            <div className="flex flex-col gap-y-2" style={{ margin: 0 }}>
              <Label>Goal</Label>
              <Textarea
                placeholder="What does success look like for this campaign? e.g. Book 5 discovery calls with B2B SaaS founders"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Outreach intent</label>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted-foreground)",
                  marginBottom: 8,
                  marginTop: 2,
                }}
              >
                Sets the tone for AI-generated drafts. Choose how you want to
                come across.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {INTENTS.map((intent) => {
                  const selected = intentType === intent.value;
                  return (
                    <button
                      key={intent.value}
                      type="button"
                      onClick={() =>
                        setIntentType(selected ? "" : intent.value)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: "var(--radius)",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected
                          ? "var(--accent-subtle)"
                          : "var(--input-bg)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: selected
                              ? "var(--accent)"
                              : "var(--foreground)",
                            margin: 0,
                          }}
                        >
                          {intent.label}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                            margin: "2px 0 0",
                          }}
                        >
                          {intent.description}
                        </p>
                      </div>
                      {selected && (
                        <CheckmarkCircle01Icon
                          size={16}
                          style={{ color: "var(--accent)", flexShrink: 0 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                onClick={() => setStep("leads")}
                disabled={!canProceedDetails}
              >
                Next: Select Leads
              </Button>
            </div>
          </div>
        )}

        {/* Step: Select Leads */}
        {step === "leads" && (
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Select Leads
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginLeft: 8,
                  }}
                >
                  {selectedLeads.size} selected
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
                {selectedLeads.size === filteredLeads.length &&
                filteredLeads.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                value={fitFilter}
                onValueChange={(v) => setFitFilter(v as typeof fitFilter)}
              >
                <SelectTrigger size="default" className="w-32">
                  <SelectValue placeholder="Fit" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All fits</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={scoreSort}
                onValueChange={(v) => setScoreSort(v as typeof scoreSort)}
              >
                <SelectTrigger size="default" className="w-36">
                  <SelectValue placeholder="Score" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="desc">Score: high → low</SelectItem>
                  <SelectItem value="asc">Score: low → high</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              style={{
                maxHeight: 360,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {filteredLeads.length === 0 && (
                <EmptyState
                  icon={
                    search || fitFilter !== "all" ? (
                      <FilterIcon />
                    ) : (
                      <UserGroupIcon />
                    )
                  }
                  title={
                    search || fitFilter !== "all"
                      ? "No leads match your filters"
                      : "No leads in pipeline yet"
                  }
                  size="sm"
                />
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
                      background: checked
                        ? "var(--accent-subtle)"
                        : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {lead.company}
                        </span>
                        {lead.fit && (
                          <span
                            className={
                              FIT_BADGE[lead.fit] ?? "badge badge-gray"
                            }
                          >
                            {lead.fit}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                          marginTop: 2,
                        }}
                      >
                        {lead.ceo} · {lead.email || "no email"}
                      </div>
                    </div>
                    {lead.score != null && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted-foreground)",
                          flexShrink: 0,
                        }}
                      >
                        {lead.score}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setStep("details")}
              >
                Back
              </button>
              <Button onClick={() => setStep("review")}>Next: Review</Button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <div>
              <p className="form-label" style={{ marginBottom: 4 }}>
                Campaign Name
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{name}</p>
            </div>

            {channels.length > 0 && (
              <div>
                <p className="form-label" style={{ marginBottom: 4 }}>
                  Channels
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {channels.map((c) => CHANNEL_META[c].label).join(", ")}
                </p>
              </div>
            )}

            {goal && (
              <div>
                <p className="form-label" style={{ marginBottom: 4 }}>
                  Goal
                </p>
                <p
                  style={{
                    fontSize: 13,
                    margin: 0,
                    color: "var(--muted-foreground)",
                    lineHeight: 1.5,
                  }}
                >
                  {goal}
                </p>
              </div>
            )}

            {intentType && (
              <div>
                <p className="form-label" style={{ marginBottom: 4 }}>
                  Outreach intent
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {INTENTS.find((i) => i.value === intentType)?.label}
                </p>
              </div>
            )}

            <div>
              <p className="form-label" style={{ marginBottom: 8 }}>
                Leads ({selectedLeads.size})
              </p>
              {selectedLeads.size === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    margin: 0,
                  }}
                >
                  No leads selected — you can add them later.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {Array.from(selectedLeads)
                    .map((id) => leads.find((l) => l.id === id))
                    .filter((l): l is Lead => !!l)
                    .slice(0, 5)
                    .map((l) => (
                      <div
                        key={l.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {l.company}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {l.ceo}
                        </span>
                      </div>
                    ))}
                  {selectedLeads.size > 5 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        margin: 0,
                      }}
                    >
                      +{selectedLeads.size - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setStep("leads")}
              >
                Back
              </button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
