import * as React from "react";
import { LogOut, Sun, Moon } from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { useTheme } from "./ThemeToggle";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface SidebarFooterProps {
  workspaceId: string;
}

export function SidebarFooter({ workspaceId }: SidebarFooterProps) {
  const { data: session } = authClient.useSession();
  const { theme, toggle } = useTheme();
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/sign-in";
  }

  return (
    <div className="px-2 pb-2 pt-1 border-t border-[var(--border)]">
      {user && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-[var(--radius)] hover:bg-white/5 transition-colors">
          {/* Avatar */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-[var(--muted-foreground)]"
            style={{ background: "var(--muted)" }}
          >
            {getInitials(user.name)}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--foreground)] truncate leading-none">
              {user.name}
            </div>
          </div>

          {/* Icon actions */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/10 transition-colors"
            >
              {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
            </button>

            <button
              onClick={handleSignOut}
              title="Sign out"
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-white/10 transition-colors"
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
