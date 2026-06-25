import * as React from "react";
import { Logout01Icon, Sun01Icon, Moon01Icon, Search01Icon } from "hugeicons-react";
import { authClient } from "~/lib/auth-client";
import { useTheme } from "./ThemeToggle";
import { Breadcrumbs } from "./Breadcrumbs";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function TopBar() {
  const { data: session } = authClient.useSession();
  const { theme, setTheme, resolved } = useTheme();
  function toggle() { setTheme(resolved === "dark" ? "light" : "dark"); }
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/sign-in";
  }

  return (
    <div className="h-13 flex items-center px-5 gap-3 border-b border-border shrink-0">
      {/* LEFT: Breadcrumbs */}
      <div className="flex-1 flex items-center min-w-0">
        <Breadcrumbs />
      </div>

      {/* CENTER: Search */}
      <div className="flex items-center gap-2 bg-muted border border-border rounded h-8 px-2.5 w-90 shrink-0">
        <Search01Icon size={13} className="text-muted-foreground shrink-0" />
        <input
          placeholder="Search leads, keywords, or settings..."
          className="flex-1 bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground"
        />
        <kbd className="text-[10px] text-muted-foreground bg-card border border-border rounded px-1 py-px font-mono shrink-0">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>

      {/* RIGHT: User controls */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {user && (
          <>
            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
            >
              {theme === "dark" ? <Sun01Icon size={13} /> : <Moon01Icon size={13} />}
            </button>

            <div className="w-px h-4.5 bg-border mx-0.5" />

            <div className="flex items-center gap-2">
              <div className="size-6.5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                {getInitials(user.name)}
              </div>
              <span className="text-[12px] font-medium text-foreground">{user.name}</span>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign out"
              className="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-white/8 transition-colors"
            >
              <Logout01Icon size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="main-area flex flex-col">
      <TopBar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
