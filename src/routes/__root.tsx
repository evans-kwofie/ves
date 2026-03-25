/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
  redirect,
  useMatches,
} from "@tanstack/react-router";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { Sidebar } from "~/components/layout/Sidebar";
import { Shell } from "~/components/layout/Shell";
import { Toaster } from "sonner";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { getSessionFn } from "~/lib/session";

const PUBLIC_ROUTES = ["/sign-in", "/sign-up"];

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
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const isPublic = PUBLIC_ROUTES.some((p) => location.pathname.startsWith(p));
    console.log("[beforeLoad] path:", location.pathname, "| isPublic:", isPublic);
    const session = await getSessionFn();
    console.log("[beforeLoad] session:", session ? `user=${session.user.email}` : "null");

    if (!isPublic && !session) {
      console.log("[beforeLoad] no session — redirecting to /sign-in");
      throw redirect({ to: "/sign-in" });
    }
    if (isPublic && session) {
      console.log("[beforeLoad] already authenticated — redirecting to /");
      throw redirect({ to: "/" });
    }

    return { session };
  },
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const matches = useMatches();
  const isAuthPage = matches.some(
    (m) =>
      typeof m.routeId === "string" &&
      PUBLIC_ROUTES.some((p) => m.routeId.includes(p.replace("/", ""))),
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {isAuthPage ? (
          <Outlet />
        ) : (
          <div className="app-layout">
            <Sidebar />
            <Shell>{children}</Shell>
          </div>
        )}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 13,
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}
