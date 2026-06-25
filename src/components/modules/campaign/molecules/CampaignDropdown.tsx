import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
  Loading03Icon,
} from "hugeicons-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useAddLeadStore } from "~/store/add-lead-to-campaign";
import type { CampaignStatus } from "~/types/campaign";

interface CampaignDropdownMenuProps {
  campaignId: string;
  workspaceId: string;
  status: CampaignStatus;
  existingLeadIds?: string[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CampaignStatus) => void;
  onLeadAdded?: (lead: import("~/types/lead").Lead) => void;
}

export default function CampaignDropdownMenu({
  campaignId,
  workspaceId,
  status,
  existingLeadIds = [],
  onDelete,
  onStatusChange,
  onLeadAdded,
}: CampaignDropdownMenuProps) {
  const navigate = useNavigate();
  const openAddLead = useAddLeadStore((s) => s.openDialog);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const isActive = status === "active";

  function handleAddLead() {
    openAddLead({
      campaignId,
      orgId: workspaceId,
      existingLeadIds,
      onLeadAdded,
    });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      onDelete(campaignId);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function handleToggleActive() {
    const next: CampaignStatus = isActive ? "draft" : "active";
    setToggling(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(campaignId, next);
    } catch {
      toast.error("Failed to update campaign");
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground cursor-pointer hover:text-foreground transition-colors outline-none">
              <MoreHorizontalIcon size={15} />
            </button>
          }
        />

        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => navigate({ to: "/$workspaceId/campaigns/$id", params: { workspaceId, id: campaignId } })}
          >
            <ArrowRight01Icon size={13} />
            Open Campaign
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleAddLead}>
            <PlusSignIcon size={13} />
            Add Contact
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleToggleActive} disabled={toggling}>
            {toggling
              ? <Loading03Icon size={13} className="animate-spin" />
              : isActive ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            {isActive ? "Pause Campaign" : "Activate Campaign"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem destructive onClick={() => setConfirmOpen(true)}>
            <Delete02Icon size={13} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete campaign?"
        description="This will permanently delete the campaign and all its drafts. This cannot be undone."
        confirmLabel="Delete campaign"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
