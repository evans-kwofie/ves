import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { getSessionFn } from "~/lib/session";
import { toast } from "sonner";

export interface AgentVoiceConfig {
  senderName: string;
  senderTitle: string;
  companyName: string;
  companyUrl: string;
  tone: string;
  avoidPhrases: string;
}

const getAgentVoice = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, string> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let voice: Partial<AgentVoiceConfig> = {};
  try { voice = metadata.agentVoice ? JSON.parse(metadata.agentVoice) : {}; } catch {}

  return {
    orgId: org.id,
    metadata,
    voice: {
      senderName:   voice.senderName   ?? "",
      senderTitle:  voice.senderTitle  ?? "",
      companyName:  voice.companyName  ?? org.name ?? "",
      companyUrl:   voice.companyUrl   ?? "",
      tone:         voice.tone         ?? "",
      avoidPhrases: voice.avoidPhrases ?? "",
    } satisfies AgentVoiceConfig,
  };
});

export const Route = createFileRoute("/$workspaceId/settings/agent")({
  loader: () => getAgentVoice(),
  component: AgentVoicePage,
});

const TONES = ["Direct", "Warm", "Formal", "Casual", "Bold", "Concise"];

function AgentVoicePage() {
  const data = Route.useLoaderData();

  if (!data) return <p className="text-[13px] text-muted-foreground">Workspace not found.</p>;

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Sender identity"
        description="Who the agent introduces itself as in emails and messages."
      >
        <SenderForm data={data} />
      </SettingsSection>

      <Divider />

      <SettingsSection
        title="Tone & style"
        description="How the agent should sound across every email and LinkedIn message it writes."
      >
        <ToneForm data={data} />
      </SettingsSection>
    </div>
  );
}

function SenderForm({ data }: { data: NonNullable<Awaited<ReturnType<typeof getAgentVoice>>> }) {
  const [senderName,  setSenderName]  = React.useState(data.voice.senderName);
  const [senderTitle, setSenderTitle] = React.useState(data.voice.senderTitle);
  const [companyName, setCompanyName] = React.useState(data.voice.companyName);
  const [companyUrl,  setCompanyUrl]  = React.useState(data.voice.companyUrl);
  const [loading, setLoading] = React.useState(false);

  const dirty =
    senderName  !== data.voice.senderName  ||
    senderTitle !== data.voice.senderTitle ||
    companyName !== data.voice.companyName ||
    companyUrl  !== data.voice.companyUrl;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const updated: AgentVoiceConfig = { ...data.voice, senderName, senderTitle, companyName, companyUrl };
    const result = await authClient.organization.update({
      organizationId: data.orgId,
      data: { metadata: { ...data.metadata, agentVoice: JSON.stringify(updated) } },
    });
    setLoading(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("Saved");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 max-w-sm">
      <FieldGroup label="Your name">
        <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Evans" />
      </FieldGroup>
      <FieldGroup label="Title">
        <Input value={senderTitle} onChange={(e) => setSenderTitle(e.target.value)} placeholder="e.g. Founder" />
      </FieldGroup>
      <FieldGroup label="Company name">
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Vesper" />
      </FieldGroup>
      <FieldGroup label="Company URL">
        <Input type="url" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://yourcompany.com" />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function ToneForm({ data }: { data: NonNullable<Awaited<ReturnType<typeof getAgentVoice>>> }) {
  const [tone, setTone] = React.useState(data.voice.tone);
  const [avoidPhrases, setAvoidPhrases] = React.useState(data.voice.avoidPhrases);
  const [loading, setLoading] = React.useState(false);

  const dirty = tone !== data.voice.tone || avoidPhrases !== data.voice.avoidPhrases;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const updated: AgentVoiceConfig = { ...data.voice, tone, avoidPhrases };
    const result = await authClient.organization.update({
      organizationId: data.orgId,
      data: { metadata: { ...data.metadata, agentVoice: JSON.stringify(updated) } },
    });
    setLoading(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("Saved");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 max-w-sm">
      <FieldGroup label="Tone">
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(tone === t ? "" : t)}
              className={[
                "px-3 py-1.5 rounded-(--radius) border text-[12px] font-medium transition-all cursor-pointer",
                tone === t
                  ? "border-accent bg-(--accent-subtle) text-accent"
                  : "border-border text-muted-foreground hover:border-accent hover:text-foreground",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Phrases to avoid">
        <Textarea
          value={avoidPhrases}
          onChange={(e) => setAvoidPhrases(e.target.value)}
          placeholder={"e.g. em-dashes, 'I hope this finds you well', 'synergy', 'touch base'"}
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground">One per line or comma-separated.</p>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border" />;
}
