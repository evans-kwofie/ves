import * as React from "react";
import { Logout01Icon, Sun01Icon, Moon01Icon, Search01Icon } from "hugeicons-react";
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

function TopBar() {
  const { data: session } = authClient.useSession();
  const { theme, toggle } = useTheme();
  const user = session?.user;

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/sign-in";
  }

  return (
    <div
      className="top-bar"
      style={{
        height: 52,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "0 1 360px",
          background: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0 10px",
          height: 32,
        }}
      >
        <Search01Icon size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
        <input
          placeholder="Search leads, keywords, or settings..."
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 12,
            color: "var(--foreground)",
          }}
        />
        <kbd
          style={{
            fontSize: 10,
            color: "var(--muted-foreground)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "1px 5px",
            fontFamily: "var(--font-mono, monospace)",
            flexShrink: 0,
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {user && (
        <>
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/8 transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            {theme === "dark" ? <Sun01Icon size={13} /> : <Moon01Icon size={13} />}
          </button>

          <div
            style={{
              width: 1,
              height: 18,
              background: "var(--border)",
              marginInline: 2,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted-foreground)",
                flexShrink: 0,
              }}
            >
              {getInitials(user.name)}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
              {user.name}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-white/8 transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer" }}
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
    <div className="main-area" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}
