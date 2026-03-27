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
import type { Keyword } from "~/types/keyword";

interface AddKeywordDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (keyword: Keyword) => void;
}

export function AddKeywordDialog({ orgId, open, onOpenChange, onSuccess }: AddKeywordDialogProps) {
  const [keyword, setKeyword] = React.useState("");
  const [subredditsRaw, setSubredditsRaw] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleClose() {
    setKeyword("");
    setSubredditsRaw("");
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    const subreddits = subredditsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/keywords/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, keyword: keyword.trim(), subreddits }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create keyword");
        return;
      }

      const created = (await res.json()) as Keyword;
      onSuccess(created);
      handleClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Keyword</DialogTitle>
          <DialogDescription>
            Add a keyword to track across Reddit, LinkedIn, and blog generation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <Label htmlFor="keyword">Keyword</Label>
            <Input
              id="keyword"
              placeholder="e.g. email routing, SaaS onboarding"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <Label htmlFor="subreddits">Subreddits (comma-separated)</Label>
            <Input
              id="subreddits"
              placeholder="e.g. startups, saas, entrepreneur"
              value={subredditsRaw}
              onChange={(e) => setSubredditsRaw(e.target.value)}
              disabled={loading}
            />
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>
              No r/ prefix needed. Leave empty to add later.
            </div>
          </div>

          {error && (
            <div style={{ color: "var(--destructive)", fontSize: 12, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !keyword.trim()}>
              {loading ? "Adding..." : "Add Keyword"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
