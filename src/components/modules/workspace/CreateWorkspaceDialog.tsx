import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Cancel01Icon } from "hugeicons-react";
import { authClient } from "~/lib/auth-client";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { useWorkspaceStore } from "~/store/workspace";

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CreateWorkspaceDialog() {
  const navigate = useNavigate();
  const { createOpen, closeCreate } = useWorkspaceStore();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  function handleSlugChange(v: string) {
    setSlugTouched(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  function handleClose() {
    closeCreate();
    setName("");
    setSlug("");
    setSlugTouched(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    const result = await authClient.organization.create({ name: name.trim(), slug: slug.trim() });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to create workspace");
    } else if (result.data) {
      toast.success("Workspace created");
      handleClose();
      navigate({ to: "/$workspaceId", params: { workspaceId: result.data.id } });
    }
  }

  if (!createOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={handleClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-105 rounded-xl overflow-hidden flex flex-col bg-muted border border-card-border shadow-2xl">
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">New workspace</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Organise your work under a separate brand or project.</p>
          </div>
          <button
            onClick={handleClose}
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          >
            <Cancel01Icon size={13} />
          </button>
        </div>

        <div className="mx-3 rounded-lg p-4 flex flex-col gap-4 bg-card border border-card-border">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My company"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">URL slug</label>
            <div className="flex items-center">
              <span className="text-[12px] text-muted-foreground px-2.5 h-9 flex items-center rounded-l-md shrink-0 bg-muted border border-card-border border-r-0">
                nextreach.app/
              </span>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-company"
                required
                className="rounded-l-none"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-3 pt-3 pb-4">
          <Button type="submit" disabled={loading || !name.trim() || !slug.trim()} className="w-full">
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </>
  );
}
