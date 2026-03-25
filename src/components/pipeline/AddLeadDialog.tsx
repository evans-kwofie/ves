import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import type { Lead, FitRating } from "~/types/lead";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (lead: Lead) => void;
}

export function AddLeadDialog({ open, onOpenChange, onSuccess }: AddLeadDialogProps) {
  const [form, setForm] = React.useState({
    company: "",
    website: "",
    whatTheyDo: "",
    ceo: "",
    email: "",
    linkedin: "",
    fit: "HIGH" as FitRating,
    notes: "",
  });
  const [loading, setLoading] = React.useState(false);

  function reset() {
    setForm({
      company: "",
      website: "",
      whatTheyDo: "",
      ceo: "",
      email: "",
      linkedin: "",
      fit: "HIGH",
      notes: "",
    });
  }

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Failed to add lead");
        return;
      }
      const lead = (await res.json()) as Lead;
      onSuccess(lead);
      reset();
      onOpenChange(false);
      toast.success("Lead added");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription>Manually add a company to your pipeline.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="form-group">
              <Label>Company *</Label>
              <Input value={form.company} onChange={update("company")} required disabled={loading} />
            </div>
            <div className="form-group">
              <Label>Website</Label>
              <Input value={form.website} onChange={update("website")} disabled={loading} placeholder="https://" />
            </div>
          </div>

          <div className="form-group">
            <Label>What they do</Label>
            <Input value={form.whatTheyDo} onChange={update("whatTheyDo")} disabled={loading} placeholder="One sentence" />
          </div>

          <div className="two-col">
            <div className="form-group">
              <Label>CEO / Founder *</Label>
              <Input value={form.ceo} onChange={update("ceo")} required disabled={loading} />
            </div>
            <div className="form-group">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={update("email")} required disabled={loading} />
            </div>
          </div>

          <div className="two-col">
            <div className="form-group">
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedin} onChange={update("linkedin")} disabled={loading} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="form-group">
              <Label>ICP Fit</Label>
              <select className="input" value={form.fit} onChange={update("fit")} disabled={loading}>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={update("notes")} disabled={loading} placeholder="Why this company?" style={{ minHeight: 60 }} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
