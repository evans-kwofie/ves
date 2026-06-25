/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { Toaster } from "sonner";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { getSessionFn } from "~/lib/session";
import { CreateWorkspaceDialog } from "~/components/modules/workspace/CreateWorkspaceDialog";
import { AddLeadToCampaignDialog } from "~/components/modules/campaign/AddLeadToCampaignDialog";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      ...seo({
        title: "Vesper | Marketing Toolkit",
        description:
          "A full marketing toolkit: keywords, Reddit, LinkedIn, blog generation, lead pipeline, and AI agent.",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  beforeLoad: async () => {
    const session = await getSessionFn();
    return { session };
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

const themeScript = `(function(){try{var t=localStorage.getItem("vesper-theme"),d="dark";if(t==="light")d="light";else if(t==="dark")d="dark";else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)d="light";document.documentElement.setAttribute("data-theme",d)}catch(e){}})();`;

function RootDocument({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const read = () => {
      setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script prevents theme flash on load/navigation */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster
          theme={theme}
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
            },
          }}
        />
        <CreateWorkspaceDialog />
        <AddLeadToCampaignDialog />
        <Scripts />
      </body>
    </html>
  );
}
