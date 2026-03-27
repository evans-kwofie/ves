import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { auth } from "~/lib/auth";
import { authClient } from "~/lib/auth-client";
import { getSessionFn } from "~/lib/session";
import { toast } from "sonner";

// ─── Server ──────────────────────────────────────────────────────────────────

const getDangerData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  return org ? { workspaceId: org.id, workspaceName: org.name } : null;
});

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/settings/danger")({
  loader: async () => {
    const data = await getDangerData();
    return { data };
  },
  component: DangerPage,
});

// ─── Page ────────────────────────────────────────────────────────────────────

function DangerPage() {
  const { data } = Route.useLoaderData();

  return (
    <div className="flex flex-col gap-8">
      <DeleteWorkspaceSection
        workspaceId={data?.workspaceId ?? null}
        workspaceName={data?.workspaceName ?? ""}
      />
      <div className="border-t border-[var(--border)]" />
      <DeleteAccountSection />
    </div>
  );
}

// ─── Delete workspace ─────────────────────────────────────────────────────────

function DeleteWorkspaceSection({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string | null;
  workspaceName: string;
}) {
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);
  const [showDialog, setShowDialog] = React.useState(false);

  async function handleConfirmedDelete() {
    if (!workspaceId) return;
    setLoading(true);
    const result = await authClient.organization.delete({ organizationId: workspaceId });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to delete workspace");
      setShowDialog(false);
    } else {
      setShowDialog(false);
      setDeleted(true);
      toast.success("Workspace deleted");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--destructive)]">Delete workspace</h2>
        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
          Permanently deletes{" "}
          <span className="font-semibold text-[var(--foreground)]">{workspaceName}</span> and all
          its data. This cannot be undone.
        </p>
      </div>

      {deleted ? (
        <p className="text-[13px] text-[var(--accent)] font-medium">Workspace deleted.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (workspaceId && confirm === workspaceName) setShowDialog(true);
          }}
          className="flex flex-col gap-3 max-w-sm"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              Type{" "}
              <span className="font-mono normal-case tracking-normal text-[var(--foreground)]">
                {workspaceName}
              </span>{" "}
              to confirm
            </label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={workspaceName}
              disabled={!workspaceId}
            />
          </div>
          <div>
            <Button
              type="submit"
              variant="danger"
              disabled={loading || confirm !== workspaceName}
            >
              Delete workspace
            </Button>
          </div>
        </form>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--destructive)", fontSize: 15 }}>
              This action is permanent
            </DialogTitle>
          </DialogHeader>

          <p className="text-[13px] text-[var(--muted-foreground)] mt-1 mb-3">
            Deleting{" "}
            <span className="font-semibold text-[var(--foreground)]">{workspaceName}</span> will
            immediately and permanently remove:
          </p>

          <ul
            className="text-[13px] text-[var(--muted-foreground)] flex flex-col gap-1.5 mb-4"
            style={{ paddingLeft: 18, listStyleType: "disc" }}
          >
            <li>All keywords and subreddit tracking</li>
            <li>All leads and pipeline history</li>
            <li>All Reddit posts and engagement data</li>
            <li>All blog posts and LinkedIn content</li>
            <li>All outreach records and notes</li>
            <li>All workspace members and their access</li>
          </ul>

          <p className="text-[12px] text-[var(--destructive)] font-medium mb-1">
            This cannot be undone.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmedDelete} disabled={loading}>
              {loading ? "Deleting…" : `Yes, delete ${workspaceName}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Delete account ───────────────────────────────────────────────────────────

function DeleteAccountSection() {
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showDialog, setShowDialog] = React.useState(false);

  async function handleConfirmedDelete() {
    setLoading(true);
    const result = await authClient.deleteUser({ callbackURL: "/sign-in" });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to delete account");
      setShowDialog(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--destructive)]">Delete account</h2>
        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
          Permanently deletes your account and all associated data. Delete your workspace first.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm === "delete my account") setShowDialog(true);
        }}
        className="flex flex-col gap-3 max-w-sm"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            Type{" "}
            <span className="font-mono normal-case tracking-normal text-[var(--foreground)]">
              delete my account
            </span>{" "}
            to confirm
          </label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="delete my account"
          />
        </div>
        <div>
          <Button
            type="submit"
            variant="danger"
            disabled={loading || confirm !== "delete my account"}
          >
            Delete account
          </Button>
        </div>
      </form>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--destructive)", fontSize: 15 }}>
              This action is permanent
            </DialogTitle>
          </DialogHeader>

          <p className="text-[13px] text-[var(--muted-foreground)] mt-1 mb-3">
            Deleting your account will immediately and permanently remove:
          </p>

          <ul
            className="text-[13px] text-[var(--muted-foreground)] flex flex-col gap-1.5 mb-4"
            style={{ paddingLeft: 18, listStyleType: "disc" }}
          >
            <li>Your profile and login credentials</li>
            <li>Access to all workspaces you belong to</li>
            <li>All personal settings and preferences</li>
            <li>Any content or data tied to your account</li>
          </ul>

          <p className="text-[12px] text-[var(--destructive)] font-medium mb-1">
            This cannot be undone.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmedDelete} disabled={loading}>
              {loading ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
