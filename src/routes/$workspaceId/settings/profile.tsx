import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";
import { getSessionFn } from "~/lib/session";
import { toast } from "sonner";

// ─── Server ──────────────────────────────────────────────────────────────────

const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  return { name: session.user.name, email: session.user.email, image: session.user.image ?? null };
});

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/settings/profile")({
  loader: async () => {
    const profile = await getProfile();
    return { profile };
  },
  component: ProfilePage,
});

// ─── Page ────────────────────────────────────────────────────────────────────

function ProfilePage() {
  const { profile } = Route.useLoaderData();

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Profile"
        description="Update your display name and profile picture."
      >
        <ProfileForm initialName={profile?.name ?? ""} email={profile?.email ?? ""} />
      </SettingsSection>

      <Divider />

      <SettingsSection
        title="Change password"
        description="Use a strong password you don't use elsewhere."
      >
        <PasswordForm />
      </SettingsSection>

    </div>
  );
}

// ─── Profile form ─────────────────────────────────────────────────────────────

function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = React.useState(initialName);
  const [loading, setLoading] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await authClient.updateUser({ name });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to update profile");
    } else {
      toast.success("Profile updated");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
      <FieldGroup label="Full name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
        />
      </FieldGroup>
      <FieldGroup label="Email">
        <Input value={email} disabled className="opacity-50 cursor-not-allowed" />
        <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
          Email cannot be changed.
        </p>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={loading || name === initialName}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── Password form ────────────────────────────────────────────────────────────

function PasswordForm() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: false,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to change password");
    } else {
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <FieldGroup label="Current password">
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
          required
        />
      </FieldGroup>
      <FieldGroup label="New password">
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Min. 8 characters"
          minLength={8}
          required
        />
      </FieldGroup>
      <FieldGroup label="Confirm new password">
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={loading || !current || !next || !confirm}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className={`text-[14px] font-semibold ${danger ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}>
          {title}
        </h2>
        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{description}</p>
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
