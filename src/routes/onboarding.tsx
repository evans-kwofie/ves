import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { ArrowRight01Icon, ArrowLeft01Icon } from "hugeicons-react";
import { useForm } from "react-hook-form";
import { auth } from "~/lib/auth";
import { getSessionFn } from "~/lib/session";
import { authClient } from "~/lib/auth-client";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { z } from "zod";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(v: string) {
  return v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const importedProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  benefits: z.array(z.string()),
  idealCustomer: z.string().nullable().optional(),
  pricingModel: z.enum(["custom", "fixed", "starting_at", "usage_based"]),
  priceAmount: z.number().nullable().optional(),
  priceCurrency: z.string().nullable().optional(),
  offerTerms: z.string().nullable().optional(),
  qualificationConstraints: z.string().nullable().optional(),
  proofPoints: z.array(z.string()),
});

const onboardingSchema = z.object({
  name: z.string(), slug: z.string(), slugTouched: z.boolean(), logo: z.string(),
  website: z.string(), industry: z.string(), companySize: z.string(), description: z.string(),
  icp: z.string(), messaging: z.string(), importedProducts: z.array(importedProductSchema),
});

type ImportedProduct = z.infer<typeof importedProductSchema>;
type FormState = z.infer<typeof onboardingSchema>;

// ─── Root component ───────────────────────────────────────────────────────────

function OnboardingPage() {
  const { userName } = Route.useLoaderData();
  const firstName = userName.split(" ")[0] || "";

  const [step, setStep] = React.useState<Step>(1);
  const [animKey, setAnimKey] = React.useState(0);
  const [createdOrgId, setCreatedOrgId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const { getValues, setValue, watch } = useForm<FormState>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "", slug: "", slugTouched: false, logo: "",
      website: "", industry: "", companySize: "", description: "", icp: "", messaging: "", importedProducts: [],
    },
  });
  const form = watch();

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setValue(key as never, val as never, { shouldDirty: true, shouldValidate: true });
  }

  function handleNameChange(val: string) {
    update("name", val);
    if (!getValues("slugTouched")) update("slug", slugify(val));
  }

  function handleSlugChange(val: string) {
    update("slug", slugify(val));
    update("slugTouched", true);
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
        ...(form.description ? { description: form.description } : {}),
        ...(form.icp ? { icp: form.icp } : {}),
        ...(form.messaging ? { messaging: form.messaging } : {}),
      },
    });
    setLoading(false);

    if (result.error) {
      toast.error(result.error.message ?? "Failed to create workspace");
      return;
    }

    if (form.importedProducts.length) {
      const imports = await Promise.allSettled(form.importedProducts.map((product) => fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...product, organizationId: result.data.id }),
      })));
      if (imports.some((item) => item.status === "rejected" || (item.status === "fulfilled" && !item.value.ok))) {
        toast.error("Your workspace was created, but some imported products need to be added manually.");
      }
    }
    setCreatedOrgId(result.data.id);
    advance(6);
  }

  const step2Valid = form.name.trim().length > 0 && form.slug.trim().length > 0;
  const targetingValid = form.icp.trim().length >= 12 && form.messaging.trim().length >= 12;
  const productsValid = form.importedProducts.length > 0 && form.importedProducts.every((product) => product.name.trim() && product.description.trim());

  const TOTAL = 4; // form steps: 2, 3, 4, 5
  const progress = step - 1; // 0 on welcome, 1–3 on form steps

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="h-[60px] flex items-center justify-between px-8 border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <span className="text-[15px] font-bold tracking-tight">
          nextreach<span className="text-[var(--accent)]">.</span>
        </span>

        {step > 1 && step < 6 && (
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
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-10">
        <div
          key={animKey}
          className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-center"
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
              description={form.description}
              companyName={form.name}
              onWebsiteChange={v => update("website", v)}
              onIndustryChange={v => update("industry", v)}
              onCompanySizeChange={v => update("companySize", v)}
              onDescriptionChange={v => update("description", v)}
              onProductsFound={v => update("importedProducts", v)}
              importedProducts={form.importedProducts}
            />
          )}
          {step === 4 && (
            <StepTargeting
              icp={form.icp}
              messaging={form.messaging}
              onIcpChange={v => update("icp", v)}
              onMessagingChange={v => update("messaging", v)}
            />
          )}
          {step === 5 && <StepProducts products={form.importedProducts} onChange={(products) => update("importedProducts", products)} />}
          {step === 6 && <StepDone orgName={form.name} orgId={createdOrgId} />}
        </div>
      </main>

      {/* Footer nav */}
      {step > 1 && step < 6 && (
        <footer className="h-[68px] flex items-center justify-between px-8 border-t border-[var(--border)] bg-[var(--background)] shrink-0">
          <Button
            onClick={() => advance((step - 1) as Step)}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft01Icon size={14} />
            Back
          </Button>

          {step < 5 ? (
            <Button
              onClick={() => advance((step + 1) as Step)}
              disabled={(step === 2 && !step2Valid) || (step === 4 && !targetingValid)}
              size="lg"
            >
              Continue
              <ArrowRight01Icon size={14} />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={loading || !productsValid}
              size="lg"
            >
              {loading ? "Creating..." : "Create workspace"}
              {!loading && <ArrowRight01Icon size={14} />}
            </Button>
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
        Welcome to Nextreach
      </p>
      <h1 className="text-[44px] font-bold tracking-[-0.04em] leading-[1.05] mb-5 text-[var(--foreground)]">
        {firstName ? `Hey, ${firstName}.` : "Let's get started."}
      </h1>
      <p className="text-[15px] text-[var(--muted-foreground)] leading-relaxed mb-12 max-w-[380px] mx-auto">
        We'll set up your workspace in three quick steps. Keywords, leads, content — all ready to go.
      </p>
      <Button
        onClick={onNext}
        size="lg"
      >
        Get started
        <ArrowRight01Icon size={15} />
      </Button>
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
      <OnboardingInput
        autoFocus
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Acme Inc."
        size="hero"
      />

      {/* Slug preview */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[12px] text-[var(--muted-foreground)]">
          nextreach.app/
          <span className="text-[var(--foreground)] font-medium">
            {slug || "your-workspace"}
          </span>
        </span>
        <Button
          onClick={() => setEditingSlug(s => !s)}
          variant="link"
          size="xs"
        >
          {editingSlug ? "done" : "edit slug"}
        </Button>
      </div>

      {editingSlug && (
        <div className="mt-2">
          <OnboardingInput
            value={slug}
            onChange={e => onSlugChange(e.target.value)}
            placeholder="acme-inc"
            size="compact"
          />
        </div>
      )}

      {/* Logo */}
      <div className="mt-8">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-2">
          Logo URL <span className="font-normal normal-case tracking-normal">— optional</span>
        </label>
        <OnboardingInput
          type="url"
          value={logo}
          onChange={e => onLogoChange(e.target.value)}
          placeholder="https://example.com/logo.png"
          size="standard"
        />
        {logo && <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]"><img src={logo} alt="Logo preview" className="size-7 rounded-md object-cover" />Logo preview</div>}
      </div>
    </div>
  );
}

// ─── Step 3: About your business ─────────────────────────────────────────────

function StepAbout({
  website, industry, companySize, description, companyName,
  onWebsiteChange, onIndustryChange, onCompanySizeChange, onDescriptionChange, onProductsFound, importedProducts,
}: {
  website: string; industry: string; companySize: string;
  description: string; companyName: string;
  onWebsiteChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onCompanySizeChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onProductsFound: (products: ImportedProduct[]) => void;
  importedProducts: ImportedProduct[];
}) {
  const [scraping, setScraping] = React.useState(false);
  const [scrapeError, setScrapeError] = React.useState("");
  const [pricingMessage, setPricingMessage] = React.useState("");
  const lastScannedWebsite = React.useRef<string | null>(null);

  async function handleWebsiteBlur() {
    const normalizedWebsite = website.trim();
    if (!normalizedWebsite || !normalizedWebsite.startsWith("http") || normalizedWebsite === lastScannedWebsite.current) return;
    lastScannedWebsite.current = normalizedWebsite;
    setScraping(true);
    setScrapeError("");
    try {
      const [descriptionResponse, productsResponse] = await Promise.all([
        fetch("/api/workspace/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: website.trim(), name: companyName }),
        }),
        fetch("/api/workspace/extract-products", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: website.trim() }),
        }),
      ]);
      const data = await descriptionResponse.json() as { description?: string; error?: string };
      if (data.description) {
        onDescriptionChange(data.description);
      } else {
        setScrapeError(data.error ?? "Couldn't read the website");
      }
      const productData = await productsResponse.json() as { products?: ImportedProduct[]; industry?: string | null; message?: string };
      if (productData.industry && !industry) onIndustryChange(productData.industry);
      if (productData.products?.length) {
        onProductsFound(productData.products);
        setPricingMessage(`${productData.products.length} product${productData.products.length === 1 ? "" : "s"} found on the pricing page${productData.industry && !industry ? `; industry set to ${productData.industry}` : ""} — review them in settings.`);
      } else {
        onProductsFound([]);
        setPricingMessage(productData.message ?? "No product information found — you can add it later.");
      }
    } catch {
      lastScannedWebsite.current = null;
      setScrapeError("Couldn't reach the website");
    } finally {
      setScraping(false);
    }
  }

  React.useEffect(() => {
    if (!website.trim().startsWith("http") || website.trim() === lastScannedWebsite.current) return;
    const timer = window.setTimeout(() => { void handleWebsiteBlur(); }, 800);
    return () => window.clearTimeout(timer);
  }, [website]);

  return (
    <div>
      <StepLabel>Your business</StepLabel>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        Tell us about your business
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10">
        Add your website, then scan its pricing page. You can review and configure every discovered offer in Products settings.
      </p>

      {/* Website */}
      <div className="mb-8">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)] mb-2">
          Website
        </label>
        <div className="flex gap-2">
          <OnboardingInput type="url" value={website} onChange={e => onWebsiteChange(e.target.value)} placeholder="https://example.com" autoFocus size="standard" />
          <Button type="button" size="sm" onClick={() => { lastScannedWebsite.current = null; void handleWebsiteBlur(); }} disabled={scraping || !website.trim().startsWith("http")} className="mt-0.5 shrink-0">{scraping ? "Scanning…" : "Scan again"}</Button>
        </div>
      </div>

      {pricingMessage && <p className="-mt-5 mb-6 text-xs leading-5 text-muted-foreground">{pricingMessage}</p>}
      {importedProducts.length > 0 && <div className="-mt-3 mb-6 rounded-[var(--radius)] border border-[var(--border)] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Offers to configure</p><ul className="mt-2 space-y-1 text-[12px] text-[var(--foreground)]">{importedProducts.map((product) => <li key={product.name}>• {product.name}{product.priceAmount != null ? ` — ${product.pricingModel === "starting_at" ? "from " : ""}${product.priceAmount} ${product.priceCurrency ?? ""}` : ""}</li>)}</ul><p className="mt-2 text-[11px] text-[var(--muted-foreground)]">These will be added as editable drafts in Products settings.</p></div>}

      {/* Description — auto-populated from scrape */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Description
          </label>
          {scraping && (
            <span className="text-[11px] text-muted-foreground animate-pulse">
              Reading website…
            </span>
          )}
          {scrapeError && (
            <span className="text-[11px] text-destructive">{scrapeError}</span>
          )}
        </div>
        <OnboardingTextarea
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="What does your company do? Who are your customers?"
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

function OnboardingInput({ size = "standard", className = "", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "hero" | "standard" | "compact" }) {
  const sizes = {
    hero: "pb-3 text-[28px] font-semibold tracking-[-0.02em]",
    standard: "pb-2 text-[18px] font-medium tracking-[-0.01em]",
    compact: "pb-1.5 text-[14px]",
  };
  return <input {...props} className={`w-full border-0 border-b-2 border-[var(--border)] bg-transparent text-[var(--foreground)] outline-none transition-colors duration-150 placeholder:text-[var(--muted-foreground)] placeholder:opacity-70 focus:border-[var(--accent)] ${sizes[size]} ${className}`} />;
}

function OnboardingTextarea({ className = "", value, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      rows={1}
      className={`w-full resize-none overflow-hidden border-0 border-b-2 border-[var(--border)] bg-transparent px-0 py-2 text-[16px] leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] placeholder:opacity-70 focus:border-[var(--accent)] ${className}`}
    />
  );
}

// ─── Step 4: Focus areas ──────────────────────────────────────────────────────

function StepTargeting({ icp, messaging, onIcpChange, onMessagingChange }: { icp: string; messaging: string; onIcpChange: (value: string) => void; onMessagingChange: (value: string) => void }) {
  return (
    <div>
      <StepLabel>Targeting</StepLabel>
      <h2 className="text-[36px] font-bold tracking-[-0.03em] leading-tight mb-3 text-[var(--foreground)]">
        Who gets the most value?
      </h2>
      <p className="text-[14px] text-[var(--muted-foreground)] mb-10">
        This grounds lead scoring, research, and every message from day one.
      </p>
      <div className="space-y-8">
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Ideal customer profile</label>
          <OnboardingTextarea value={icp} onChange={(event) => onIcpChange(event.target.value)} placeholder="e.g. Founders and revenue leaders at 10–100 person B2B SaaS companies who need a repeatable outbound pipeline." />
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Include role, company type/size, pain, and a buying signal.</p>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Positioning and proof</label>
          <OnboardingTextarea value={messaging} onChange={(event) => onMessagingChange(event.target.value)} placeholder="e.g. Replace manual prospect research with verified buying signals. Used by lean B2B teams to reach qualified buyers faster." />
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">State the promise, differentiator, and proof the agent can use accurately.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Success ──────────────────────────────────────────────────────────

function StepProducts({ products, onChange }: { products: ImportedProduct[]; onChange: (products: ImportedProduct[]) => void }) {
  function updateProduct(index: number, updates: Partial<ImportedProduct>) {
    onChange(products.map((product, productIndex) => productIndex === index ? { ...product, ...updates } : product));
  }
  function addProduct() {
    onChange([...products, { name: "", description: "", benefits: [], pricingModel: "custom", proofPoints: [] }]);
  }
  return <div>
    <StepLabel>Offers</StepLabel>
    <h2 className="mb-3 text-[36px] font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)]">Confirm what you sell</h2>
    <p className="mb-8 text-[14px] text-[var(--muted-foreground)]">These details are used to choose the right offer for each prospect. Review the scan or add your first offer.</p>
    <div className="space-y-5">
      {products.map((product, index) => <article key={index} className="rounded-[var(--radius)] border border-[var(--border)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Offer {index + 1}</span><Button type="button" variant="ghost" size="xs" onClick={() => onChange(products.filter((_, productIndex) => productIndex !== index))}>Remove</Button></div>
        <div className="space-y-4"><OnboardingInput value={product.name} onChange={(event) => updateProduct(index, { name: event.target.value })} placeholder="Offer name" size="standard" /><OnboardingTextarea value={product.description} onChange={(event) => updateProduct(index, { description: event.target.value })} placeholder="What outcome does this offer provide?" className="text-[15px]" /><OnboardingInput value={product.benefits.join(", ")} onChange={(event) => updateProduct(index, { benefits: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Key benefits, separated by commas" size="compact" /></div>
      </article>)}
      <Button type="button" variant="outline" onClick={addProduct}>Add an offer</Button>
      {products.length === 0 && <p className="text-sm text-destructive">Add at least one offer to give outreach a reliable product context.</p>}
    </div>
  </div>;
}

function StepDone({ orgName, orgId }: { orgName: string; orgId: string | null }) {
  React.useEffect(() => {
    if (!orgId) return;
    const t = setTimeout(() => { window.location.href = `/${orgId}/pipeline`; }, 3500);
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
        Your workspace, offer context, and targeting are ready. Start by adding or importing your first prospects.
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

      <Button
        onClick={() => { if (orgId) window.location.href = `/${orgId}/pipeline`; }}
        disabled={!orgId}
        size="lg"
      >
        Add prospects
        <ArrowRight01Icon size={15} />
      </Button>

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
    <Button
      onClick={onSelect}
      variant="outline"
      size="default"
      className={[
        "px-4 py-2 text-[13px]",
        selected
          ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </Button>
  );
}
