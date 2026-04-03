import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { getSessionFn } from "~/lib/session";
import { toast } from "sonner";
import type { SmtpConfig } from "~/types/smtp";

// ─── Server ───────────────────────────────────────────────────────────────────

const getSmtpConfig = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, string> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let smtp: Partial<SmtpConfig> = {};
  try { smtp = metadata.smtpConfig ? JSON.parse(metadata.smtpConfig) : {}; } catch {}

  return {
    orgId: org.id,
    metadata,
    smtp: {
      host: smtp.host ?? "",
      port: smtp.port ?? 587,
      user: smtp.user ?? "",
      pass: smtp.pass ?? "",
      fromName: smtp.fromName ?? "",
      secure: smtp.secure ?? false,
    } satisfies SmtpConfig,
  };
});

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/settings/email")({
  loader: () => getSmtpConfig(),
  component: EmailSettingsPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function EmailSettingsPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return <p className="text-[13px] text-[var(--muted-foreground)]">Workspace not found.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="SMTP configuration"
        description="The email account the AI agent sends outreach from. Each workspace has its own sender — use an app password, not your main account password."
      >
        <SmtpForm data={data} />
      </SettingsSection>

      <Divider />

      <SettingsSection
        title="How to get an app password"
        description=""
      >
        <div className="flex flex-col gap-3 text-[13px] text-[var(--muted-foreground)] max-w-lg">
          <p><strong className="text-[var(--foreground)]">Gmail:</strong> Go to Google Account → Security → 2-Step Verification → App passwords. Create one for "Mail". Use <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">smtp.gmail.com</code>, port <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">587</code>.</p>
          <p><strong className="text-[var(--foreground)]">Zoho:</strong> Go to Zoho Mail → Settings → Security → App-Specific Passwords. Use <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">smtp.zoho.com</code>, port <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">587</code>.</p>
          <p><strong className="text-[var(--foreground)]">Outlook / Microsoft 365:</strong> Use <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">smtp.office365.com</code>, port <code className="text-[11px] bg-[var(--muted)] px-1.5 py-0.5 rounded">587</code>, with your regular password (if SMTP AUTH is enabled by your admin).</p>
          <p><strong className="text-[var(--foreground)]">Custom / other:</strong> Ask your email provider for SMTP host, port, and authentication details.</p>
        </div>
      </SettingsSection>
    </div>
  );
}

// ─── SMTP form ────────────────────────────────────────────────────────────────

function SmtpForm({ data }: { data: NonNullable<Awaited<ReturnType<typeof getSmtpConfig>>> }) {
  const [host, setHost] = React.useState(data.smtp.host);
  const [port, setPort] = React.useState(String(data.smtp.port));
  const [user, setUser] = React.useState(data.smtp.user);
  const [pass, setPass] = React.useState(data.smtp.pass);
  const [fromName, setFromName] = React.useState(data.smtp.fromName);
  const [secure, setSecure] = React.useState(data.smtp.secure);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const dirty =
    host !== data.smtp.host ||
    port !== String(data.smtp.port) ||
    user !== data.smtp.user ||
    pass !== data.smtp.pass ||
    fromName !== data.smtp.fromName ||
    secure !== data.smtp.secure;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const updated: SmtpConfig = {
      host: host.trim(),
      port: Number(port) || 587,
      user: user.trim(),
      pass,
      fromName: fromName.trim(),
      secure,
    };
    const result = await authClient.organization.update({
      organizationId: data.orgId,
      data: { metadata: { ...data.metadata, smtpConfig: JSON.stringify(updated) } },
    });
    setLoading(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("SMTP settings saved");
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/email/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: host.trim(), port: Number(port) || 587, user: user.trim(), pass, fromName: fromName.trim(), secure }),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string };
      if (result.ok) toast.success("Connection successful — test email sent to yourself");
      else toast.error(result.error ?? "Connection failed");
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 max-w-sm">
      <FieldGroup label="From name">
        <Input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="e.g. Evans from MailBridge"
        />
        <p className="text-[11px] text-[var(--muted-foreground)]">Shown as the sender name in every outreach email.</p>
      </FieldGroup>

      <FieldGroup label="Email address (SMTP user)">
        <Input
          type="email"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="you@yourcompany.com"
        />
      </FieldGroup>

      <FieldGroup label="App password">
        <Input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••••••••••"
          autoComplete="new-password"
        />
        <p className="text-[11px] text-[var(--muted-foreground)]">Use an app-specific password, not your account login password.</p>
      </FieldGroup>

      <div className="two-col">
        <FieldGroup label="SMTP host">
          <Input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.gmail.com"
          />
        </FieldGroup>
        <FieldGroup label="Port">
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="587"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Security">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
            style={{ accentColor: "var(--accent)", width: 14, height: 14 }}
          />
          <span>Use SSL (port 465)</span>
        </label>
        <p className="text-[11px] text-[var(--muted-foreground)]">Leave unchecked for STARTTLS on port 587 — the default for most providers.</p>
      </FieldGroup>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save settings"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={testConnection}
          disabled={testing || !host || !user || !pass}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
      </div>
    </form>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
        {description && <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)]" />;
}
