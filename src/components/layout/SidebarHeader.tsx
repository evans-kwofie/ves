import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Check, Plus, X } from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  logo?: string | null;
}

interface SidebarHeaderProps {
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string | null;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function WorkspaceAvatar({
  name,
  logo,
  size = 20,
}: {
  name: string;
  logo?: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "var(--accent)",
        color: "var(--accent-foreground)",
        fontSize: size * 0.42,
      }}
      className="rounded-full flex items-center justify-center font-bold shrink-0 leading-none"
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Create workspace dialog ───────────────────────────────────────────────────

function CreateWorkspaceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    const result = await authClient.organization.create({
      name: name.trim(),
      slug: slug.trim(),
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to create workspace");
    } else if (result.data) {
      toast.success("Workspace created");
      onCreated(result.data.id);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />

      {/* Dialog shell — gray outer */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] rounded-[12px] overflow-hidden flex flex-col"
        style={{
          background: "var(--muted)",
          border: "1px solid var(--card-border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header — in gray */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <p className="text-[13px] font-semibold text-[var(--foreground)]">New workspace</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Organise your work under a separate brand or project.</p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/10 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* White inner content card */}
        <div
          className="mx-3 rounded-[8px] p-4 flex flex-col gap-4"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
          }}
        >
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My company"
              autoFocus
              required
            />
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              URL slug
            </label>
            <div className="flex items-center">
              <span
                className="text-[12px] text-[var(--muted-foreground)] px-2.5 h-9 flex items-center rounded-l-[var(--radius)] shrink-0"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--card-border)",
                  borderRight: "none",
                }}
              >
                vesper.app/
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

        {/* Footer — button sits back in the gray */}
        <form onSubmit={handleSubmit} className="px-3 pt-3 pb-4">
          <Button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim()}
            className="w-full"
          >
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </>
  );
}

// ─── Workspace selector dropdown ──────────────────────────────────────────────

export function SidebarHeader({ workspaceId, workspaceName, workspaceLogo }: SidebarHeaderProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  // Load workspaces when dropdown opens
  React.useEffect(() => {
    if (!open) return;
    authClient.organization.list().then((res) => {
      if (res.data) setWorkspaces(res.data);
    });
  }, [open]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleSelect(id: string) {
    setOpen(false);
    if (id !== workspaceId) navigate({ to: "/$workspaceId/", params: { workspaceId: id } });
  }

  function handleCreated(id: string) {
    setShowCreate(false);
    setOpen(false);
    navigate({ to: "/$workspaceId/", params: { workspaceId: id } });
  }

  return (
    <>
      <div ref={ref} className="relative mx-1 mt-1">
        {/* Trigger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-3 rounded-[var(--radius)] hover:bg-white/5 transition-colors group cursor-pointer"
          style={{ background: "none", border: "none" }}
        >
          <WorkspaceAvatar name={workspaceName} logo={workspaceLogo} size={22} />
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-[var(--foreground)] truncate leading-none text-left">
            {workspaceName}
          </span>
          <ChevronsUpDown
            size={13}
            className="shrink-0 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-[8px] py-1 overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {/* Workspace list */}
            {workspaces.map((ws) => {
              const active = ws.id === workspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "none")
                  }
                >
                  <WorkspaceAvatar name={ws.name} logo={ws.logo} size={18} />
                  <span className="flex-1 min-w-0 text-[12px] font-medium truncate">
                    {ws.name}
                  </span>
                  {active && <Check size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                </button>
              );
            })}

            {/* Divider */}
            <div className="my-1 h-px" style={{ background: "var(--border)" }} />

            {/* New workspace */}
            <button
              onClick={() => { setOpen(false); setShowCreate(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "none")
              }
            >
              <div
                className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center shrink-0"
                style={{ background: "var(--muted)" }}
              >
                <Plus size={10} style={{ color: "var(--muted-foreground)" }} />
              </div>
              <span className="text-[12px] font-medium">New workspace</span>
            </button>
          </div>
        )}
      </div>

      {/* Create dialog rendered in portal-like fashion at root */}
      {showCreate && (
        <CreateWorkspaceDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
