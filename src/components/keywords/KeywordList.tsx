import * as React from "react";
import { Delete01Icon, HashtagIcon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import type { Keyword } from "~/types/keyword";

interface KeywordListProps {
  keywords: Keyword[];
  onChange: (keywords: Keyword[]) => void;
}

export function KeywordList({ keywords, onChange }: KeywordListProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function toggleActive(keyword: Keyword) {
    try {
      await fetch(`/api/keywords/${keyword.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !keyword.isActive }),
      });
      onChange(
        keywords.map((k) => (k.id === keyword.id ? { ...k, isActive: !k.isActive } : k)),
      );
    } catch {
      toast.error("Failed to update keyword");
    }
  }

  async function deleteKeyword(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/keywords/${id}`, { method: "DELETE" });
      onChange(keywords.filter((k) => k.id !== id));
      toast.success("Keyword deleted");
    } catch {
      toast.error("Failed to delete keyword");
    } finally {
      setDeletingId(null);
    }
  }

  if (keywords.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <HashtagIcon size={32} />
        </div>
        <div>No keywords yet. Add your first keyword to get started.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Subreddits</th>
            <th>Status</th>
            <th>Added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((keyword) => (
            <tr key={keyword.id}>
              <td>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
                  {keyword.keyword}
                </span>
              </td>
              <td>
                <div className="tag-list">
                  {(keyword.subreddits ?? []).slice(0, 4).map((sub) => (
                    <span key={sub.id} className="tag">
                      r/{sub.name}
                    </span>
                  ))}
                  {(keyword.subreddits ?? []).length > 4 && (
                    <span className="tag">+{(keyword.subreddits ?? []).length - 4}</span>
                  )}
                  {(keyword.subreddits ?? []).length === 0 && (
                    <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                      None
                    </span>
                  )}
                </div>
              </td>
              <td>
                <button
                  onClick={() => toggleActive(keyword)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <Badge variant={keyword.isActive ? "green" : "default"}>
                    {keyword.isActive ? "Active" : "Paused"}
                  </Badge>
                </button>
              </td>
              <td style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
                {new Date(keyword.createdAt).toLocaleDateString()}
              </td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteKeyword(keyword.id)}
                  disabled={deletingId === keyword.id}
                  style={{ color: "var(--destructive)" }}
                >
                  <Delete01Icon size={13} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
