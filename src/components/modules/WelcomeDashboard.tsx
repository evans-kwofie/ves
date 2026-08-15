import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  UserAdd01Icon,
  Target01Icon,
  Mail01Icon,
  ArrowRight01Icon,
  BubbleChatIcon,
  SearchList01Icon,
} from "hugeicons-react";

interface Step {
  number: number;
  title: string;
  description: string;
  cta: string;
  to: string;
  params: Record<string, string>;
  icon: React.ReactNode;
  mockup: React.ReactNode;
  done?: boolean;
}

// ─── Mini mockup components ───────────────────────────────────────────────────

function PipelineMockup() {
  const rows = [
    { co: "Vercel", status: "new", fit: "HIGH" },
    { co: "Resend", status: "contacted", fit: "HIGH" },
    { co: "Neon DB", status: "new", fit: "MEDIUM" },
  ];
  return (
    <div style={{ fontSize: 10, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 40px", gap: "0 8px", borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9 }}>
        <span>Company</span><span>Status</span><span>Fit</span>
      </div>
      {rows.map((r) => (
        <div key={r.co} style={{ display: "grid", gridTemplateColumns: "1fr 70px 40px", gap: "0 8px", paddingBottom: 4 }}>
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{r.co}</span>
          <span style={{ background: "var(--muted)", borderRadius: 3, padding: "1px 5px", fontSize: 9, display: "inline-block" }}>{r.status}</span>
          <span style={{ color: r.fit === "HIGH" ? "var(--accent)" : "var(--muted-foreground)", fontWeight: 700 }}>{r.fit}</span>
        </div>
      ))}
    </div>
  );
}

function CampaignMockup() {
  return (
    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
      <div style={{ background: "var(--muted)", borderRadius: 6, padding: "6px 10px", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 11, marginBottom: 2 }}>Dev Tools Q3</div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ background: "var(--accent-subtle)", color: "var(--accent)", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>ACTIVE</span>
          <span style={{ background: "var(--muted)", borderRadius: 3, padding: "1px 5px", fontSize: 9 }}>email</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[["Leads", "12"], ["Sent", "8"], ["Replies", "3"]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftMockup() {
  return (
    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
      <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 11, marginBottom: 2 }}>Re: Faster deployments for dev tools</div>
        <div style={{ lineHeight: 1.5, color: "var(--muted-foreground)" }}>
          Saw what you're building at Vercel — the deploy pipeline problem is exactly what we solve...
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 700 }}>APPROVE</span>
        <span style={{ background: "var(--muted)", borderRadius: 4, padding: "2px 8px", fontSize: 9 }}>Edit</span>
        <span style={{ background: "var(--muted)", borderRadius: 4, padding: "2px 8px", fontSize: 9 }}>Skip</span>
      </div>
    </div>
  );
}

function SignalsMockup() {
  const posts = [
    { sub: "devops", title: "Anyone using AI for outreach?", intent: "buying" },
    { sub: "startups", title: "Best cold email tools in 2025", intent: "pain" },
  ];
  return (
    <div style={{ fontSize: 10 }}>
      {posts.map((p) => (
        <div key={p.title} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.intent === "buying" ? "var(--accent)" : "#f59e0b", marginTop: 3, flexShrink: 0 }} />
          <div>
            <div style={{ color: "var(--foreground)", fontWeight: 600, lineHeight: 1.4 }}>{p.title}</div>
            <div style={{ color: "var(--muted-foreground)", fontSize: 9 }}>r/{p.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WelcomeDashboard({
  workspaceId,
  userName,
  hasLeads,
  hasCampaigns,
  hasKeywords,
}: {
  workspaceId: string;
  userName: string;
  hasLeads: boolean;
  hasCampaigns: boolean;
  hasKeywords: boolean;
}) {
  const firstName = userName ? userName.split(" ")[0] : null;

  const steps: Step[] = [
    {
      number: 1,
      title: "Add your first leads",
      description: "Build a list of companies and contacts you want to reach. Add company details, the CEO name, fit notes, and a score.",
      cta: "Go to Pipeline",
      to: "/$workspaceId/pipeline",
      params: { workspaceId },
      icon: <UserAdd01Icon size={18} />,
      mockup: <PipelineMockup />,
      done: hasLeads,
    },
    {
      number: 2,
      title: "Create a campaign",
      description: "Group your leads into a campaign with a goal. Choose email or LinkedIn as the channel.",
      cta: "New Campaign",
      to: "/$workspaceId/campaigns/new",
      params: { workspaceId },
      icon: <Target01Icon size={18} />,
      mockup: <CampaignMockup />,
      done: hasCampaigns,
    },
    {
      number: 3,
      title: "Generate & review drafts",
      description: "Hit Generate Drafts and Nextreach writes a personalised message for each lead using their company context. You approve, edit, or skip before anything sends.",
      cta: "View Campaigns",
      to: "/$workspaceId/campaigns",
      params: { workspaceId },
      icon: <Mail01Icon size={18} />,
      mockup: <DraftMockup />,
      done: hasCampaigns && hasLeads,
    },
    {
      number: 4,
      title: "Monitor signals",
      description: "Track keywords on Reddit to catch buying intent, pain points, and feature requests in real time. Turn hot posts into leads instantly.",
      cta: "Set up Keywords",
      to: "/$workspaceId/keywords",
      params: { workspaceId },
      icon: <BubbleChatIcon size={18} />,
      mockup: <SignalsMockup />,
      done: hasKeywords,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--foreground)", margin: 0 }}>
          {firstName ? `Welcome, ${firstName}.` : "Welcome to Nextreach."}
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 6, marginBottom: 0 }}>
          Your outreach operating system. Here's how to get started.
        </p>

        {/* Progress bar */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 99 }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--accent)",
                borderRadius: 99,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
            {completedCount} / {steps.length} done
          </span>
        </div>
      </div>

      {/* Step cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`card${!step.done ? " step-card-enter" : ""}`}
            style={{
              "--card-i": i,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              opacity: step.done ? 0.5 : 1,
              position: "relative",
              overflow: "hidden",
            } as React.CSSProperties}
          >
            {/* Done tick */}
            {step.done && (
              <div style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="var(--accent-foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}

            {/* Step number + icon */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: step.done ? "var(--muted)" : "var(--accent-subtle)",
                color: step.done ? "var(--muted-foreground)" : "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                  Step {step.number}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.2 }}>
                  {step.title}
                </div>
              </div>
            </div>

            {/* Mockup preview */}
            <div style={{
              background: "var(--muted)",
              borderRadius: 8,
              padding: 12,
              border: "1px solid var(--border)",
            }}>
              {step.mockup}
            </div>

            {/* Description + CTA */}
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6, margin: 0 }}>
              {step.description}
            </p>

            {!step.done && (
              <Link
                to={step.to as never}
                params={step.params as never}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--accent)",
                  textDecoration: "none",
                  marginTop: "auto",
                }}
              >
                {step.cta}
                <ArrowRight01Icon size={12} />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Bottom hint */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        background: "var(--muted)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}>
        <SearchList01Icon size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
          <strong style={{ color: "var(--foreground)" }}>Pro tip:</strong> Set your company profile in{" "}
          <Link
            to="/$workspaceId/settings/profile"
            params={{ workspaceId }}
            style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
          >
            Settings → Profile
          </Link>{" "}
          — Nextreach uses it to write more relevant outreach for every lead.
        </p>
      </div>
    </div>
  );
}
