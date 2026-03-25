import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Header } from "~/components/layout/Header";
import { initDb } from "~/db/schema";
import { getDashboardStats } from "~/db/queries/leads";
import { getBlogPostCount } from "~/db/queries/blog";
import { getRedditPostCount } from "~/db/queries/reddit";
import { listKeywords } from "~/db/queries/keywords";

const getDashboard = createServerFn().handler(async () => {
  await initDb();
  const [leadStats, blogCount, redditCount, keywords] = await Promise.all([
    getDashboardStats(),
    getBlogPostCount(),
    getRedditPostCount(),
    listKeywords(),
  ]);
  return {
    ...leadStats,
    blogPosts: blogCount,
    redditPosts: redditCount,
    keywords: keywords.length,
    activeKeywords: keywords.filter((k) => k.isActive).length,
  };
});

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: DashboardPage,
});

type DashboardStats = Awaited<ReturnType<typeof getDashboard>>;

const STAT_ITEMS: Array<{ key: keyof DashboardStats; label: string; green: boolean }> = [
  { key: "totalLeads", label: "Total Leads", green: false },
  { key: "activeKeywords", label: "Active Keywords", green: true },
  { key: "totalEmailsSent", label: "Emails Sent", green: false },
  { key: "replied", label: "Replies", green: true },
  { key: "converted", label: "Converted", green: true },
  { key: "blogPosts", label: "Blog Posts", green: false },
  { key: "redditPosts", label: "Reddit Posts", green: false },
  { key: "keywords", label: "Keywords", green: false },
];

function DashboardPage() {
  const stats = Route.useLoaderData();

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Overview of your marketing activity across all channels."
      />
      <div className="page-content">
        <div className="stat-grid">
          {STAT_ITEMS.map((item) => (
            <div key={item.key} className="stat-card">
              <div className="stat-label">{item.label}</div>
              <div className={`stat-value${item.green && stats[item.key] > 0 ? " green" : ""}`}>
                {stats[item.key]}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--muted-foreground)",
              marginBottom: 16,
            }}
          >
            Quick Actions
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { href: "/keywords", label: "Manage Keywords" },
              { href: "/reddit", label: "Reddit Monitor" },
              { href: "/linkedin", label: "LinkedIn Tools" },
              { href: "/pipeline", label: "Lead Pipeline" },
              { href: "/blog", label: "Generate Blog Post" },
              { href: "/agent", label: "Run AI Agent" },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="btn btn-ghost"
                style={{ textDecoration: "none" }}
              >
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
