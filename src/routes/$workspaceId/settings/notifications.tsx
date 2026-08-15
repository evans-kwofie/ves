import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { toast } from "sonner";

// ─── Server ───────────────────────────────────────────────────────────────────

const getNotificationSettings = createServerFn({ method: "GET" })
  .inputValidator(z.string())
  .handler(async ({ data: workspaceId }) => {
    const headers = getRequestHeaders();
    const orgs = await auth.api.listOrganizations({ headers });
    const org = orgs?.find((o) => o.id === workspaceId || o.slug === workspaceId);
    if (!org) return null;
    let meta: Record<string, string> = {};
    try { meta = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}
    return {
      orgId: org.id,
      metadata: meta,
      slackWebhookUrl: meta.slackWebhookUrl ?? "",
      slackEventReply:  meta.slackEventReply  !== "false",
      slackEventBounce: meta.slackEventBounce !== "false",
      slackEventDrafts: meta.slackEventDrafts !== "false",
    };
  });

export const Route = createFileRoute("/$workspaceId/settings/notifications")({
  loader: ({ params }) => getNotificationSettings({ data: params.workspaceId }),
  component: NotificationsPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function NotificationsPage() {
  const data = Route.useLoaderData();

  if (!data) return <p className="text-[13px] text-muted-foreground">Workspace not found.</p>;

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <SlackSection data={data} />
    </div>
  );
}

// ─── Slack section ────────────────────────────────────────────────────────────

function SlackSection({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getNotificationSettings>>>;
}) {
  const [webhookUrl, setWebhookUrl] = React.useState(data.slackWebhookUrl);
  const [eventReply,  setEventReply]  = React.useState(data.slackEventReply);
  const [eventBounce, setEventBounce] = React.useState(data.slackEventBounce);
  const [eventDrafts, setEventDrafts] = React.useState(data.slackEventDrafts);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [showUrl, setShowUrl] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await authClient.organization.update({
      organizationId: data.orgId,
      data: {
        metadata: {
          ...data.metadata,
          slackWebhookUrl:  webhookUrl.trim(),
          slackEventReply:  String(eventReply),
          slackEventBounce: String(eventBounce),
          slackEventDrafts: String(eventDrafts),
        },
      },
    });
    setSaving(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("Notification settings saved");
  }

  async function sendTest() {
    if (!webhookUrl.trim()) {
      toast.error("Enter a webhook URL first");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "✅ Nextreach is connected. Notifications are working.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "✅ *Nextreach is connected*\nThis is a test notification. Your Slack integration is working correctly.",
              },
            },
          ],
        }),
      });
      if (res.ok) toast.success("Test notification sent to Slack");
      else toast.error("Slack returned an error — check the webhook URL");
    } catch {
      toast.error("Failed to reach Slack — check the URL and try again");
    } finally {
      setTesting(false);
    }
  }

  const configured = webhookUrl.trim().startsWith("https://hooks.slack.com");

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[14px] font-semibold text-foreground">Slack</h2>
        <p className="text-[12px] text-muted-foreground">
          Get notified in Slack when leads reply, emails bounce, or new drafts are ready.
        </p>
      </div>

      {/* Webhook URL */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Incoming webhook URL
        </label>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Create one in your Slack workspace under <strong>Apps → Incoming Webhooks</strong>.
        </p>
        <div className="flex items-center gap-2">
          <input
            type={showUrl ? "text" : "password"}
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="input flex-1 text-[12px] font-mono"
          />
          <button
            type="button"
            onClick={() => setShowUrl((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2"
          >
            {showUrl ? "Hide" : "Show"}
          </button>
        </div>
        {configured && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground">Webhook configured</span>
          </div>
        )}
      </div>

      {/* Event toggles */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-card-border bg-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Notify me when
        </p>

        <EventToggle
          label="A lead replies"
          description="Someone replies to your outreach email"
          checked={eventReply}
          onChange={setEventReply}
        />
        <EventToggle
          label="An email bounces"
          description="Delivery fails and the lead is reset to not contacted"
          checked={eventBounce}
          onChange={setEventBounce}
        />
        <EventToggle
          label="Drafts are ready"
          description="A campaign generates a new batch of drafts awaiting approval"
          checked={eventDrafts}
          onChange={setEventDrafts}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={sendTest}
          disabled={testing || !webhookUrl.trim()}
        >
          {testing ? "Sending…" : "Send test notification"}
        </Button>
      </div>
    </form>
  );
}

// ─── Event toggle ─────────────────────────────────────────────────────────────

function EventToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-accent" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <div>
        <p className="text-[13px] font-medium text-foreground leading-none">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </div>
    </label>
  );
}
