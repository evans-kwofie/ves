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

// ─── Server ──────────────────────────────────────────────────────────────────

const getWorkspaceDetails = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, string> = {};
  try {
    metadata = org.metadata ? JSON.parse(org.metadata as string) : {};
  } catch {}

  return {
    id: org.id,
    name: org.name,
    slug: org.slug ?? "",
    logo: org.logo ?? "",
    metadata, // full object — used to merge on save so no keys are lost
    website: metadata.website ?? "",
    industry: metadata.industry ?? "",
    companySize: metadata.companySize ?? "",
    description: metadata.description ?? "",
  };
});

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/settings/workspace")({
  loader: async () => {
    const workspace = await getWorkspaceDetails();
    return { workspace };
  },
  component: WorkspacePage,
});

// ─── Page ────────────────────────────────────────────────────────────────────

function WorkspacePage() {
  const { workspace } = Route.useLoaderData();

  if (!workspace) {
    return <p className="text-[13px] text-[var(--muted-foreground)]">Workspace not found.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="Workspace details" description="Manage your workspace name, slug, and branding.">
        <WorkspaceForm workspace={workspace} />
      </SettingsSection>

      <Divider />

      <SettingsSection title="Business context" description="This helps the AI agent tailor suggestions to your business.">
        <BusinessContextForm workspace={workspace} />
      </SettingsSection>
    </div>
  );
}

// ─── Workspace identity form ──────────────────────────────────────────────────

function WorkspaceForm({ workspace }: { workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceDetails>>> }) {
  const [name, setName] = React.useState(workspace.name);
  const [slug, setSlug] = React.useState(workspace.slug);
  const [logo, setLogo] = React.useState(workspace.logo);
  const [loading, setLoading] = React.useState(false);

  const dirty = name !== workspace.name || slug !== workspace.slug || logo !== workspace.logo;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await authClient.organization.update({
      organizationId: workspace.id,
      data: {
        name: name.trim() || undefined,
        slug: slug.trim() || undefined,
        logo: logo.trim() || undefined,
      },
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to update workspace");
    } else {
      toast.success("Workspace updated");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
      <FieldGroup label="Workspace name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </FieldGroup>
      <FieldGroup label="URL slug">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">vesper.app/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          />
        </div>
      </FieldGroup>
      <FieldGroup label="Logo URL">
        <Input
          type="url"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
        {logo && (
          <img src={logo} alt="Logo preview" className="w-8 h-8 rounded object-cover mt-1" />
        )}
      </FieldGroup>
      <div>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── Business context form ────────────────────────────────────────────────────

const INDUSTRIES = [
  "SaaS", "Agency", "E-commerce", "Consulting", "Media & Content",
  "Healthcare", "Finance", "Education", "Other",
];
const COMPANY_SIZES = ["Solo", "2–10", "11–50", "51–200", "200+"];

function BusinessContextForm({ workspace }: { workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceDetails>>> }) {
  const [website, setWebsite] = React.useState(workspace.website);
  const [industry, setIndustry] = React.useState(workspace.industry);
  const [companySize, setCompanySize] = React.useState(workspace.companySize);
  const [description, setDescription] = React.useState(workspace.description);
  const [loading, setLoading] = React.useState(false);

  const dirty =
    website !== workspace.website ||
    industry !== workspace.industry ||
    companySize !== workspace.companySize ||
    description !== workspace.description;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await authClient.organization.update({
      organizationId: workspace.id,
      data: {
        // Spread existing metadata so unrelated keys (e.g. plan) are preserved
        metadata: { ...workspace.metadata, website, industry, companySize, description },
      },
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to update");
    } else {
      toast.success("Saved");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 max-w-sm">
      <FieldGroup label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your company do, and who do you sell to?"
          rows={3}
        />
      </FieldGroup>

      <FieldGroup label="Website">
        <Input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
      </FieldGroup>

      <FieldGroup label="Industry">
        <div className="flex flex-wrap gap-1.5">
          {INDUSTRIES.map((opt) => (
            <OptionChip
              key={opt}
              label={opt}
              selected={industry === opt}
              onSelect={() => setIndustry(industry === opt ? "" : opt)}
            />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Team size">
        <div className="flex flex-wrap gap-1.5">
          {COMPANY_SIZES.map((opt) => (
            <OptionChip
              key={opt}
              label={opt}
              selected={companySize === opt}
              onSelect={() => setCompanySize(companySize === opt ? "" : opt)}
            />
          ))}
        </div>
      </FieldGroup>

      <div>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save changes"}
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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
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

function OptionChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "px-3 py-1.5 rounded-[var(--radius)] border text-[12px] font-medium transition-all cursor-pointer",
        selected
          ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)]" />;
}
