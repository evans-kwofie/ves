import * as React from "react";
import { Sun01Icon, Moon01Icon, ComputerIcon } from "hugeicons-react";

const STORAGE_KEY = "vesper-theme";

export type ThemeSetting = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return setting;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<ThemeSetting>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as ThemeSetting | null) ?? "system";
  });

  const resolved = resolveTheme(theme);

  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    function onchange() {
      applyTheme(mq.matches ? "light" : "dark");
    }
    mq.addEventListener("change", onchange);
    return () => mq.removeEventListener("change", onchange);
  }, [theme]);

  function setTheme(next: ThemeSetting) {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(resolveTheme(next));
  }

  return { theme, setTheme, resolved };
}

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();

  function toggle() {
    setTheme(resolved === "dark" ? "light" : "dark");
  }

  return (
    <button className="theme-toggle" onClick={toggle}>
      {resolved === "dark" ? <Sun01Icon size={15} /> : <Moon01Icon size={15} />}
      {resolved === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

export const THEME_OPTIONS: { value: ThemeSetting; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System", icon: <ComputerIcon size={15} /> },
  { value: "light",  label: "Light",  icon: <Sun01Icon size={15} /> },
  { value: "dark",   label: "Dark",   icon: <Moon01Icon size={15} /> },
];
