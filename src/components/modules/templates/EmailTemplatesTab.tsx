import * as React from "react";
import {
  FileEditIcon,
  Add01Icon,
  Mail01Icon,
  Linkedin01Icon,
  InstagramIcon,
  MoreHorizontalIcon,
  Delete02Icon,
  PencilEdit01Icon,
  TestTube01Icon,
} from "hugeicons-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Template } from "~/db/queries/templates";

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email:     <Mail01Icon size={12} />,
  linkedin:  <Linkedin01Icon size={12} />,
  instagram: <InstagramIcon size={12} />,
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email", linkedin: "LinkedIn", instagram: "Instagram",
};

interface EmailTemplatesTabProps {
  orgId: string;
  orgName?: string;
  orgLogo?: string | null;
  signerName?: string;
  initialTemplates: Template[];
}

export function EmailTemplatesTab({ initialTemplates }: EmailTemplatesTabProps) {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ strict: false }) as { workspaceId: string };
  const [templates, setTemplates] = React.useState<Template[]>(initialTemplates);
  const [confirmDelete, setConfirmDelete] = React.useState<Template | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/templates/${confirmDelete.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          onClick={() => navigate({ to: "/$workspaceId/templates/new", params: { workspaceId } })}
        >
          <Add01Icon size={13} />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileEditIcon size={28} /></div>
          <p>No templates yet.</p>
          <p className="text-[12px]">Create reusable message structures for cold intros, follow-ups, and more.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => navigate({ to: "/$workspaceId/templates/$templateId", params: { workspaceId, templateId: t.id } })}
              onDelete={() => setConfirmDelete(t)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={`Delete "${confirmDelete?.name}"?`}
        description="This template will be permanently removed."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

function TemplateCard({
  template: t,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasAB = !!(t.variantBBody);
  const [variant, setVariant] = React.useState<"a" | "b">("a");

  const subject = variant === "b" ? (t.variantBSubject ?? t.subject) : t.subject;
  const body    = variant === "b" ? (t.variantBBody ?? t.body) : t.body;

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden flex flex-col hover:border-accent/30 transition-colors">
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold truncate">{t.name}</span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {CHANNEL_ICON[t.channel]}
                {CHANNEL_LABEL[t.channel]}
              </span>
              {hasAB && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 shrink-0">
                  <TestTube01Icon size={10} />
                  A/B
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors outline-none shrink-0">
                  <MoreHorizontalIcon size={15} />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <PencilEdit01Icon size={13} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={onDelete}>
                <Delete02Icon size={13} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* A/B variant toggle */}
        {hasAB && (
          <div className="flex gap-1">
            {(["a", "b"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={[
                  "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                  variant === v
                    ? "bg-accent text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Variant {v.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Content preview */}
        <div className="flex flex-col gap-1 min-w-0">
          {subject && (
            <p className="text-[12px] text-muted-foreground truncate">
              <span className="text-foreground font-medium">Sub:</span> {subject}
            </p>
          )}
          {body && (
            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
              {body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
