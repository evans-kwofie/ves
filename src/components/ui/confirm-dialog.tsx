import { Loading03Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="text-[14px] font-semibold">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-[12px] mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="px-5 pb-5 gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1 mb-2"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1 mb-2"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loading03Icon size={13} className="animate-spin" />
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
