import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme, THEME_OPTIONS } from "~/components/templates/ThemeToggle";
import type { ThemeSetting } from "~/components/templates/ThemeToggle";

export const Route = createFileRoute("/$workspaceId/settings/appearance")({
  component: AppearancePage,
});

function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Theme"
        description="Choose how Nextreach looks on this device. System follows your OS preference."
      >
        <ThemeToggler value={theme} onChange={setTheme} />
      </SettingsSection>
    </div>
  );
}

function ThemeToggler({ value, onChange }: { value: ThemeSetting; onChange: (v: ThemeSetting) => void }) {
  return (
    <div className="inline-flex self-start items-center gap-0.5 p-0.5 rounded-lg bg-muted border border-card-border">
      {THEME_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
              active
                ? "bg-card text-foreground shadow-sm border border-card-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}
