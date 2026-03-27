import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { auth } from "~/lib/auth";
import { getSessionFn } from "~/lib/session";
import { authClient } from "~/lib/auth-client";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

// ─── Server ─────────────────────────────────────────────────────────────────

const getOnboardingData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionFn();
  if (!session) return { existingOrgId: null, userName: "" };
  const headers = getRequestHeaders();
  const orgs = await auth.api.listOrganizations({ headers });
  return {
    existingOrgId: orgs?.[0]?.id ?? null,
    userName: session.user.name,
  };
});

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/sign-in" });
  },
  loader: async () => {
    const data = await getOnboardingData();
    if (data.existingOrgId) {
      throw redirect({ to: "/$workspaceId", params: { workspaceId: data.existingOrgId } });
    }
    return { userName: data.userName };
  },
  component: OnboardingPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "SaaS", "Agency", "E-commerce", "Consulting", "Media & Content",
  "Healthcare", "Finance", "Education", "Other",
];

const COMPANY_SIZES = ["Solo", "2–10", "11–50", "51–200", "200+"];

const USE_CASES = [
  "Lead generation",
  "Content marketing",
  "Brand awareness",
  "Community building",
  "Outreach automation",
  "Competitive research",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(v: string) {
  return v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type Step = 1 | 2 | 3 | 4 | 5;

interface FormState {
  name: string;
  slug: string;
  slugTouched: boolean;
  logo: string;
  website: string;
  industry: string;
  companySize: string;
  useCases: string[];
}

// ─── Root component ───────────────────────────────────────────────────────────

function OnboardingPage() {
  const { userName } = Route.useLoaderData();
  const firstName = userName.split(" ")[0] || "";

  const [step, setStep] = React.useState<Step>(1);
  const [animKey, setAnimKey] = React.useState(0);
  const [createdOrgId, setCreatedOrgId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [form, setForm] = React.useState<FormState>({
    name: "", slug: "", slugTouched: false, logo: "",
    website: "", industry: "", companySize: "", useCases: [],
  });

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(p => ({ ...p, [key]: val }));
  }

  function handleNameChange(val: string) {
    setForm(p => ({
      ...p,
      name: val,
      slug: p.slugTouched ? p.slug : slugify(val),
    }));
  }

  function handleSlugChange(val: string) {
    setForm(p => ({ ...p, slug: slugify(val), slugTouched: true }));
  }

  function toggleUseCase(uc: string) {
    setForm(p => {
      const has = p.useCases.includes(uc);
      if (has) return { ...p, useCases: p.useCases.filter(u => u !== uc) };
      if (p.useCases.length >= 3) return p;
      return { ...p, useCases: [...p.useCases, uc] };
    });
  }

  function advance(to: Step) {
    setStep(to);
    setAnimKey(k => k + 1);
  }

  async function handleCreate() {
    setLoading(true);
    const result = await authClient.organization.create({
      name: form.name.trim(),
      slug: form.slug.trim(),
      ...(form.logo.trim() ? { logo: form.logo.trim() } : {}),
      metadata: {
        ...(form.website ? { website: form.website } : {}),
        ...(form.industry ? { industry: form.industry } : {}),
        ...(form.companySize ? { companySize: form.companySize } : {}),
        ...(form.useCases.length ? { useCases: form.useCases } : {}),
      },
    });
    setLoading(false);

    if (result.error) {
      toast.error(result.error.message ?? "Failed to create workspace");
      return;
    }

    setCreatedOrgId(result.data.id);
    advance(5);
  }

  const step2Valid = form.name.trim().length > 0 && form.slug.trim().length > 0;

  const TOTAL = 3; // form steps: 2, 3, 4
  const progress = step - 1; // 0 on welcome, 1–3 on form steps

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]"
      style={{
        backgroundImage: "radial-gradient(circle, #1a1a1a 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Header */}
      <header className="h-[60px] flex items-center justify-between px-8 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <span className="text-[15px] font-bold tracking-tight">
          vesper<span className="text-[var(--accent)]">.</span>
        </span>

        {step > 1 && step < 5 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i < progress ? 20 : 6,
                  background: i < progress ? "var(--accent)" : i === progress - 1 ? "var(--accent)" : "#2a2a2a",
                }}
              />
            ))}
            <span className="text-[11px] text-[var(--muted-foreground)] ml-1">
              {progress} of {TOTAL}
            </span>
          </div>
        )}
      </header>

      {/* Step content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div
          key={animKey}
          className="w-full max-w-[560px]"
          style={{ animation: "stepEnter 0.35s cubic-bezier(0.16,1,0.3,1) forwards" }}
        >
          {step === 1 && <StepWelcome firstName={firstName} onNext={() => advance(2)} />}
          {step === 2 && (
            <StepWorkspace
              name={form.name}
              slug={form.slug}
              logo={form.logo}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onLogoChange={v => update("logo", v)}
            />
          )}
          {step === 3 && (
            <StepAbout
              website={form.website}
              industry={form.industry}
              companySize={form.companySize}
              onWebsiteChange={v => update("website", v)}
              onIndustryChange={v => update("industry", v)}
              onCompanySizeChange={v => update("companySize", v)}
            />
          )}
          {step === 4 && (
            <StepFocus useCases={form.useCases} onToggle={toggleUseCase} />
          )}
          {step === 5 && <StepDone orgName={form.name} orgId={createdOrgId} />}
        </div>
      </main>

      {/* Footer nav */}
      {step > 1 && step < 5 && (
        <footer className="h-[68px] flex items-center justify-between px-8 border-t border-[var(--border)] bg-[var(--background)] shrink-0">
          <button
            onClick={() => advance((step - 1) as Step)}
            className="flex items-center gap-2 text-[13px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors bg-transparent border-0 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={() => advance((step + 1) as Step)}
              disabled={step === 2 && !step2Valid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius)] text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius)] text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground)",
              }}
            >
              {loading ? "Creating..." : "Create workspace"}
              {!loading && <ArrowRight size={14} />}
            </button>
          )}
        </footer>
      )}

      {/* Keyframe injection */}
      <style>{`
        @keyframes stepEnter {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--accent)] mb-5">
        Welcome to Vesper
      </p>
      <h1 className="text-[44px] font-bold tracking-[-0.04em] leading-[1.05] mb-5 text-[var(--foreground)]">
        {firstName ? `Hey, ${firstName}.` : "Let's get started."}
      </h1>
      <p className="text-[15px] text-[var(--muted-foreground)] leading-relaxed mb-12 max-w-[380px] mx-auto">
        We'll set up your workspace in three quick steps. Keywords, leads, content — all ready to go.
      </p>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-3 px-7 py-3.5 rounded-[var(--radius)] text-[14px] font-semibold transition-all hover:opacity-90"
        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        Get started
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

// ─── Step 2: Workspace identity ───────────────────────────────────────────────

function StepWorkspace({
  name, slug, logo,
  onNameChange, onSlugChange, onLogoChange,
}: {
  name: string; slug: string; logo: string;
  onNameChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onLogoChange: (v: string) => void;
}) {
  const [editingSlug, setEditingSlug] = React.useState(false);

  return (
    <div>
      <StepLabel>Workspace</StepLabel>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        Name your workspace
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10">
        This is how you and your team will identify this workspace. You can rename it anytime.
      </p>

      {/* Name — large underline input */}
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Acme Inc."
        className="w-full bg-transparent border-0 border-b-2 border-[var(--border)] focus:border-[var(--accent)] outline-none pb-3 text-[28px] font-semibold tracking-[-0.02em] text-[var(--foreground)] placeholder:text-[#2a2a2a] transition-colors"
      />

      {/* Slug preview */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[12px] text-[var(--muted-foreground)]">
          vesper.app/
          <span className="text-[var(--foreground)] font-medium">
            {slug || "your-workspace"}
          </span>
        </span>
        <button
          onClick={() => setEditingSlug(s => !s)}
          className="text-[11px] text-[var(--accent)] bg-transparent border-0 cursor-pointer font-medium hover:underline"
        >
          {editingSlug ? "done" : "edit slug"}
        </button>
      </div>

      {editingSlug && (
        <div className="mt-2">
          <Input
            value={slug}
            onChange={e => onSlugChange(e.target.value)}
            placeholder="acme-inc"
            className="text-[13px]"
          />
        </div>
      )}

      {/* Logo */}
      <div className="mt-8">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-2">
          Logo URL <span className="font-normal normal-case tracking-normal">— optional</span>
        </label>
        <Input
          type="url"
          value={logo}
          onChange={e => onLogoChange(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </div>
    </div>
  );
}

// ─── Step 3: About your business ─────────────────────────────────────────────

function StepAbout({
  website, industry, companySize,
  onWebsiteChange, onIndustryChange, onCompanySizeChange,
}: {
  website: string; industry: string; companySize: string;
  onWebsiteChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onCompanySizeChange: (v: string) => void;
}) {
  return (
    <div>
      <StepLabel>Your business</StepLabel>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        Tell us about your business
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10">
        This helps Vesper tailor suggestions to your context. All optional.
      </p>

      {/* Website */}
      <div className="mb-8">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-2">
          Website
        </label>
        <Input
          type="url"
          value={website}
          onChange={e => onWebsiteChange(e.target.value)}
          placeholder="https://example.com"
          autoFocus
        />
      </div>

      {/* Industry */}
      <div className="mb-8">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-3">
          Industry
        </label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map(opt => (
            <OptionPill
              key={opt}
              label={opt}
              selected={industry === opt}
              onSelect={() => onIndustryChange(industry === opt ? "" : opt)}
            />
          ))}
        </div>
      </div>

      {/* Company size */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-3">
          Team size
        </label>
        <div className="flex flex-wrap gap-2">
          {COMPANY_SIZES.map(opt => (
            <OptionPill
              key={opt}
              label={opt}
              selected={companySize === opt}
              onSelect={() => onCompanySizeChange(companySize === opt ? "" : opt)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Focus areas ──────────────────────────────────────────────────────

function StepFocus({
  useCases, onToggle,
}: {
  useCases: string[];
  onToggle: (uc: string) => void;
}) {
  return (
    <div>
      <StepLabel>Focus</StepLabel>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        What are you focusing on?
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10">
        Pick up to three. This helps us highlight what matters most in your dashboard.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {USE_CASES.map(uc => {
          const selected = useCases.includes(uc);
          const disabled = !selected && useCases.length >= 3;
          return (
            <button
              key={uc}
              onClick={() => onToggle(uc)}
              disabled={disabled}
              className={[
                "flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius)] border text-left text-[13px] font-medium transition-all cursor-pointer",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
                disabled ? "opacity-35 cursor-not-allowed pointer-events-none" : "",
              ].join(" ")}
            >
              <span className={[
                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]",
              ].join(" ")}>
                {selected && <Check size={9} strokeWidth={3} style={{ color: "var(--accent-foreground)" }} />}
              </span>
              {uc}
            </button>
          );
        })}
      </div>

      {useCases.length > 0 && (
        <p className="text-[11px] text-[var(--muted-foreground)] mt-4 text-right">
          {useCases.length}/3 selected
        </p>
      )}
    </div>
  );
}

// ─── Step 5: Success ──────────────────────────────────────────────────────────

function StepDone({ orgName, orgId }: { orgName: string; orgId: string | null }) {
  React.useEffect(() => {
    if (!orgId) return;
    const t = setTimeout(() => { window.location.href = `/${orgId}`; }, 3500);
    return () => clearTimeout(t);
  }, [orgId]);

  return (
    <div className="text-center flex flex-col items-center">
      {/* Animated checkmark */}
      <div className="mb-8">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="36"
            cy="36"
            r="34"
            stroke="var(--accent)"
            strokeWidth="2"
            style={{
              strokeDasharray: 214,
              strokeDashoffset: 214,
              animation: "drawCircle 0.6s ease forwards",
            }}
          />
          <path
            d="M22 37l10 10 18-18"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 50,
              strokeDashoffset: 50,
              animation: "drawCheck 0.4s ease 0.5s forwards",
            }}
          />
        </svg>
      </div>

      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--accent)] mb-4">
        All set
      </p>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        {orgName ? `${orgName} is ready.` : "Your workspace is ready."}
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10 max-w-[360px]">
        Your workspace is live. Keywords, leads, content generation, and your AI agent are all waiting.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {["Keywords", "Reddit Monitor", "LinkedIn Tools", "Lead Pipeline", "Blog Generator", "AI Agent"].map(f => (
          <span
            key={f}
            className="px-3 py-1 rounded-full text-[11px] font-medium border border-[var(--border)] text-[var(--muted-foreground)]"
          >
            {f}
          </span>
        ))}
      </div>

      <button
        onClick={() => { if (orgId) window.location.href = `/${orgId}`; }}
        disabled={!orgId}
        className="inline-flex items-center gap-3 px-7 py-3.5 rounded-[var(--radius)] text-[14px] font-semibold transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        Enter workspace
        <ArrowRight size={15} />
      </button>

      <p className="text-[11px] text-[var(--muted-foreground)] mt-4">
        Redirecting automatically…
      </p>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--accent)] mb-4">
      {children}
    </p>
  );
}

function OptionPill({
  label, selected, onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        "px-4 py-2 rounded-[var(--radius)] border text-[13px] font-medium transition-all cursor-pointer",
        selected
          ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
