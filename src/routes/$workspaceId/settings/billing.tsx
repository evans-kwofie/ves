import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { CreditCardIcon, FlashIcon, Tick01Icon } from "hugeicons-react";
import { Button } from "~/components/ui/button";
import { auth } from "~/lib/auth";
import { getSessionFn } from "~/lib/session";

// ─── Server ──────────────────────────────────────────────────────────────────

const getBillingData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return null;
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  const org = orgs?.[0];
  if (!org) return null;

  let metadata: Record<string, string> = {};
  try {
    metadata = org.metadata ? JSON.parse(org.metadata as string) : {};
  } catch {}

  return {
    orgName: org.name,
    plan: (metadata.plan as string) ?? "free",
    memberCount: 1,
  };
});

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/$workspaceId/settings/billing")({
  loader: async () => {
    const billing = await getBillingData();
    return { billing };
  },
  component: BillingPage,
});

// ─── Plans config ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals getting started.",
    features: [
      "1 workspace",
      "Up to 50 leads",
      "3 keywords",
      "Reddit monitoring",
      "Blog generation (5/mo)",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/ month",
    description: "For solo founders scaling outreach.",
    features: [
      "1 workspace",
      "Unlimited leads",
      "Unlimited keywords",
      "Full Reddit + LinkedIn tools",
      "Blog generation (unlimited)",
      "AI Agent (daily runs)",
    ],
    highlight: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$79",
    period: "/ month",
    description: "For teams that need more.",
    features: [
      "3 workspaces",
      "Everything in Starter",
      "Team members (up to 5)",
      "Priority support",
      "Advanced analytics",
    ],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

function BillingPage() {
  const { billing } = Route.useLoaderData();
  const currentPlan = billing?.plan ?? "free";

  return (
    <div className="flex flex-col gap-8">
      {/* Current plan summary */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-0.5">Current plan</h2>
        <p className="text-[12px] text-[var(--muted-foreground)] mb-4">
          You're on the <span className="font-semibold text-[var(--foreground)] capitalize">{currentPlan}</span> plan.
        </p>
        <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] border border-[var(--card-border)] bg-[var(--card)] w-fit">
          <div className="w-8 h-8 rounded-[var(--radius)] bg-[var(--accent-subtle)] flex items-center justify-center">
            <CreditCardIcon size={14} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="text-[13px] font-semibold capitalize text-[var(--foreground)]">
              {currentPlan} plan
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {currentPlan === "free" ? "No payment method on file" : "Billed monthly"}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)]" />

      {/* Plan cards */}
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--foreground)] mb-1">Plans</h2>
        <p className="text-[12px] text-[var(--muted-foreground)] mb-4">
          Upgrade or downgrade at any time.
        </p>
        <div className="grid grid-cols-1 gap-3 max-w-[600px]">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={currentPlan === plan.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  current,
}: {
  plan: (typeof PLANS)[number];
  current: boolean;
}) {
  return (
    <div
      className={[
        "flex items-start gap-4 p-4 rounded-[var(--radius)] border transition-colors",
        plan.highlight && !current
          ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
          : "border-[var(--card-border)] bg-[var(--card)]",
        current ? "border-[var(--accent)]" : "",
      ].join(" ")}
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-[var(--radius)] flex items-center justify-center shrink-0"
        style={{ background: plan.highlight ? "var(--accent-subtle)" : "var(--muted)" }}
      >
        <FlashIcon size={13} style={{ color: plan.highlight ? "var(--accent)" : "var(--muted-foreground)" }} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-[13px] font-semibold text-[var(--foreground)]">{plan.name}</span>
          <span className="text-[13px] font-semibold text-[var(--foreground)]">{plan.price}</span>
          <span className="text-[11px] text-[var(--muted-foreground)]">{plan.period}</span>
          {current && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent-subtle)] text-[var(--accent)]">
              Current
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] mb-2">{plan.description}</p>
        <ul className="flex flex-col gap-0.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
              <Tick01Icon size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="shrink-0">
        {current ? (
          <span className="text-[11px] text-[var(--muted-foreground)]">Active</span>
        ) : (
          <Button
            size="sm"
            variant={plan.highlight ? "default" : "ghost"}
            onClick={() => {
              // TODO: wire Polar checkout
            }}
          >
            {plan.id === "free" ? "Downgrade" : "Upgrade"}
          </Button>
        )}
      </div>
    </div>
  );
}
