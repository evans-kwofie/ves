import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/$workspaceId/settings/email")({
  component: EmailSettingsPage,
});

function EmailSettingsPage() {
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
    </div>
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
