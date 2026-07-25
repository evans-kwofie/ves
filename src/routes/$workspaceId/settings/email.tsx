import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { toast } from "sonner";

const getSendSettings = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: workspaceId }) => {
    const headers = getRequestHeaders();
    const orgs = await auth.api.listOrganizations({ headers });
    const org = orgs?.find((o) => o.id === workspaceId || o.slug === workspaceId);
    if (!org) return null;
    let metadata: Record<string, string> = {};
    try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}
    return {
      orgId: org.id,
      metadata,
      dailySendCap: metadata.dailySendCap ? Number(metadata.dailySendCap) : 50,
      sendWindowStart: metadata.sendWindowStart ? Number(metadata.sendWindowStart) : 8,
      sendWindowEnd: metadata.sendWindowEnd ? Number(metadata.sendWindowEnd) : 18,
      sendWeekdaysOnly: metadata.sendWeekdaysOnly !== "false",
    };
  });

export const Route = createFileRoute("/$workspaceId/settings/email")({
  loader: ({ params }) => getSendSettings({ data: params.workspaceId }),
  component: EmailSettingsPage,
});

function EmailSettingsPage() {
  const data = Route.useLoaderData();
  const [testing, setTesting] = React.useState(false);

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "test@example.com",
          subject: "Vesper test email",
          body: "If you're reading this, Resend is connected correctly.",
        }),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (result.success) toast.success("Test email sent");
      else toast.error(result.error ?? "Failed to send");
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <SettingsSection
        title="Email sending"
        description="Vesper sends outreach emails via Resend. Set your API key and verified sender address in your environment variables."
      >
        <div className="flex flex-col gap-3">
          <EnvRow name="RESEND_API_KEY" description="Your Resend API key — get one at resend.com." />
          <EnvRow name="EMAIL_FROM" description='The sender address shown to recipients. Must be a verified domain in Resend. Example: "Vesper <hello@yourdomain.com>"' />
        </div>
      </SettingsSection>

      <Divider />

      <SettingsSection
        title="Test connection"
        description="Send a test email to verify your Resend setup is working."
      >
        <Button variant="ghost" onClick={sendTest} disabled={testing} className="w-fit">
          {testing ? "Sending…" : "Send test email"}
        </Button>
      </SettingsSection>

      <Divider />

      {data && (
        <SendSchedulingForm
          orgId={data.orgId}
          metadata={data.metadata}
          dailySendCap={data.dailySendCap}
          sendWindowStart={data.sendWindowStart}
          sendWindowEnd={data.sendWindowEnd}
          sendWeekdaysOnly={data.sendWeekdaysOnly}
        />
      )}
    </div>
  );
}

function SendSchedulingForm({
  orgId,
  metadata,
  dailySendCap: initCap,
  sendWindowStart: initStart,
  sendWindowEnd: initEnd,
  sendWeekdaysOnly: initWeekdays,
}: {
  orgId: string;
  metadata: Record<string, string>;
  dailySendCap: number;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendWeekdaysOnly: boolean;
}) {
  const [dailySendCap, setDailySendCap] = React.useState(initCap);
  const [sendWindowStart, setSendWindowStart] = React.useState(initStart);
  const [sendWindowEnd, setSendWindowEnd] = React.useState(initEnd);
  const [sendWeekdaysOnly, setSendWeekdaysOnly] = React.useState(initWeekdays);
  const [saving, setSaving] = React.useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  function fmtHour(h: number) {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (sendWindowStart >= sendWindowEnd) {
      toast.error("Send window end must be after start");
      return;
    }
    setSaving(true);
    const result = await authClient.organization.update({
      organizationId: orgId,
      data: {
        metadata: {
          ...metadata,
          dailySendCap: String(dailySendCap),
          sendWindowStart: String(sendWindowStart),
          sendWindowEnd: String(sendWindowEnd),
          sendWeekdaysOnly: String(sendWeekdaysOnly),
        },
      },
    });
    setSaving(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("Send scheduling saved");
  }

  return (
    <SettingsSection
      title="Send scheduling"
      description="Control when and how many emails Vesper sends per day. Protects your domain reputation and avoids overwhelming your inbox."
    >
      <form onSubmit={handleSave} className="flex flex-col gap-5 max-w-sm">

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            Daily send cap
          </label>
          <p className="text-[11px] text-muted-foreground -mt-0.5">
            Max emails sent per day across all campaigns. Approving beyond this limit will be blocked.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input w-24 text-[13px]"
              min={1}
              max={500}
              value={dailySendCap}
              onChange={(e) => setDailySendCap(Math.max(1, Number(e.target.value)))}
            />
            <span className="text-[12px] text-muted-foreground">emails / day</span>
          </div>
          <div className="flex gap-2 flex-wrap mt-1">
            {[25, 50, 100, 200].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDailySendCap(n)}
                className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                  dailySendCap === n
                    ? "border-accent bg-(--accent-subtle) text-accent"
                    : "border-border text-muted-foreground hover:border-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            Send window
          </label>
          <p className="text-[11px] text-muted-foreground -mt-0.5">
            Emails approved outside this window will be blocked. Times are in your server timezone.
          </p>
          <div className="flex items-center gap-2">
            <select
              className="input text-[12px] w-32"
              value={sendWindowStart}
              onChange={(e) => setSendWindowStart(Number(e.target.value))}
            >
              {hours.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
            <span className="text-[12px] text-muted-foreground">to</span>
            <select
              className="input text-[12px] w-32"
              value={sendWindowEnd}
              onChange={(e) => setSendWindowEnd(Number(e.target.value))}
            >
              {hours.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={sendWeekdaysOnly}
            onClick={() => setSendWeekdaysOnly((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              sendWeekdaysOnly ? "bg-accent" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
                sendWeekdaysOnly ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <div>
            <p className="text-[13px] font-medium">Weekdays only</p>
            <p className="text-[11px] text-muted-foreground">Block sends on Saturday and Sunday</p>
          </div>
        </div>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save scheduling settings"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function EnvRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
      <code className="text-[12px] font-mono text-[var(--accent)]">{name}</code>
      <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}

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

function Divider() {
  return <div className="border-t border-[var(--border)]" />;
}
