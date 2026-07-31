import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { getSessionFn } from "~/lib/session";
import { toast } from "sonner";

export interface LinkedInWritingStyle {
  examplePosts: string;
}

const getWritingStyle = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, string> = {};
  try { metadata = org.metadata ? JSON.parse(org.metadata as string) : {}; } catch {}

  let style: Partial<LinkedInWritingStyle> = {};
  try { style = metadata.linkedinWritingStyle ? JSON.parse(metadata.linkedinWritingStyle) : {}; } catch {}

  return {
    orgId: org.id,
    metadata,
    style: {
      examplePosts: style.examplePosts ?? "",
    } satisfies LinkedInWritingStyle,
  };
});

export const Route = createFileRoute("/$workspaceId/settings/writing-style")({
  loader: () => getWritingStyle(),
  component: WritingStylePage,
});

function WritingStylePage() {
  const data = Route.useLoaderData();
  if (!data) return <p className="text-[13px] text-muted-foreground">Workspace not found.</p>;

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Example posts"
        description="Paste 2–4 LinkedIn posts you've written yourself. The AI will mirror your sentence length, vocabulary, and rhythm."
      >
        <ExamplePostsForm data={data} />
      </SettingsSection>
    </div>
  );
}

function ExamplePostsForm({ data }: { data: NonNullable<Awaited<ReturnType<typeof getWritingStyle>>> }) {
  const [examplePosts, setExamplePosts] = React.useState(data.style.examplePosts);
  const [loading, setLoading] = React.useState(false);
  const dirty = examplePosts !== data.style.examplePosts;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const updated: LinkedInWritingStyle = { ...data.style, examplePosts };
    const result = await authClient.organization.update({
      organizationId: data.orgId,
      data: { metadata: { ...data.metadata, linkedinWritingStyle: JSON.stringify(updated) } },
    });
    setLoading(false);
    if (result.error) toast.error(result.error.message ?? "Failed to save");
    else toast.success("Saved");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 max-w-lg">
      <Textarea
        value={examplePosts}
        onChange={(e) => setExamplePosts(e.target.value)}
        placeholder={"Paste one of your LinkedIn posts here...\n\n---\n\nPaste another post here (separate each with ---)"}
        rows={12}
        style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.65 }}
      />
      <p className="text-[11px] text-muted-foreground">
        Separate multiple posts with <code className="bg-muted px-1 rounded text-[10px]">---</code> on its own line.
        The more real posts you add, the better the AI matches your voice.
      </p>
      <div>
        <Button type="submit" disabled={loading || !dirty}>
          {loading ? "Saving…" : "Save examples"}
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
