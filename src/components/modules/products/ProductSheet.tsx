import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useProductSheet } from "~/store/product-sheet";
import { toast } from "sonner";

const pricingModels = [
  "custom",
  "fixed",
  "starting_at",
  "usage_based",
] as const;
const schema = z.object({
  name: z.string().trim().min(1, "Give this offering a name"),
  description: z.string().trim().min(1, "Describe what the customer gets"),
  benefits: z.string(),
  idealCustomer: z.string(),
  pricingModel: z.enum(pricingModels),
  priceAmount: z.string(),
  priceCurrency: z.string().max(3),
  offerTerms: z.string(),
  qualificationConstraints: z.string(),
  proofPoints: z.string(),
});
type Values = z.infer<typeof schema>;
export type ProductEditorProduct = {
  id: string;
  name: string;
  description: string;
  benefits?: string[] | string | null;
  ideal_customer?: string | null;
  pricing_model?: (typeof pricingModels)[number] | null;
  price_amount?: number | string | null;
  price_currency?: string | null;
  offer_terms?: string | null;
  qualification_constraints?: string | null;
  proof_points?: string[] | string | null;
};

function toLines(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.join("\n");
  if (!value) return "";
  try {
    return (JSON.parse(value) as string[]).join("\n");
  } catch {
    return value;
  }
}
function valuesFrom(product?: ProductEditorProduct | null): Values {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    benefits: toLines(product?.benefits),
    idealCustomer: product?.ideal_customer ?? "",
    pricingModel: product?.pricing_model ?? "custom",
    priceAmount: product?.price_amount?.toString() ?? "",
    priceCurrency: product?.price_currency ?? "USD",
    offerTerms: product?.offer_terms ?? "",
    qualificationConstraints: product?.qualification_constraints ?? "",
    proofPoints: toLines(product?.proof_points),
  };
}

export function ProductSheet({
  organizationId,
  product,
  onSaved,
}: {
  organizationId: string;
  product?: ProductEditorProduct | null;
  onSaved: (product: ProductEditorProduct) => void;
}) {
  const { open, closeSheet } = useProductSheet();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: valuesFrom(product),
  });
  React.useEffect(() => {
    form.reset(valuesFrom(product));
  }, [form, product, open]);
  async function submit(values: Values) {
    const price = values.priceAmount.trim();
    if (price && !Number.isFinite(Number(price)))
      return form.setError("priceAmount", { message: "Enter a valid amount" });
    const payload = {
      organizationId,
      name: values.name,
      description: values.description,
      benefits: values.benefits
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      idealCustomer: values.idealCustomer.trim() || null,
      pricingModel: values.pricingModel,
      priceAmount: price ? Number(price) : null,
      priceCurrency: values.priceCurrency.trim().toUpperCase() || null,
      offerTerms: values.offerTerms.trim() || null,
      qualificationConstraints: values.qualificationConstraints.trim() || null,
      proofPoints: values.proofPoints
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    const response = await fetch(
      product ? `/api/products/${product.id}` : "/api/products",
      {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) return toast.error("Could not save product");
    const result = (await response.json()) as { id: string };
    onSaved(
      product
        ? { ...product, ...toDatabaseShape(payload) }
        : {
            id: result.id,
            name: payload.name,
            description: payload.description,
            ...toDatabaseShape(payload),
          },
    );
    closeSheet();
    toast.success(product ? "Product updated" : "Product added");
  }
  return (
    <Sheet open={open} onOpenChange={(value) => !value && closeSheet()}>
      <SheetContent className="flex w-full flex-col p-0 sm:min-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{product ? "Edit product" : "Add product"}</SheetTitle>
          <SheetDescription>
            {product
              ? "Keep the offer details current so outreach stays accurate and specific."
              : "Add the details your outreach needs to describe this offer with confidence."}
          </SheetDescription>
        </SheetHeader>
        <form
          id="product-form"
          onSubmit={form.handleSubmit(submit)}
          className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5"
        >
          <section className="space-y-4">
            <p className="text-sm font-medium">The offering</p>
            <Field
              label="Product name"
              error={form.formState.errors.name?.message}
            >
              <Input
                {...form.register("name")}
                placeholder="e.g. Growth plan"
              />
            </Field>
            <Field
              label="Description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                {...form.register("description")}
                rows={3}
                placeholder="What does a customer receive?"
              />
            </Field>
            <Field label="Key benefits" hint="One benefit per line">
              <Textarea
                {...form.register("benefits")}
                rows={4}
                placeholder={"Qualified meetings\nClear pipeline visibility"}
              />
            </Field>
            <Field label="Ideal customer">
              <Input
                {...form.register("idealCustomer")}
                placeholder="e.g. B2B SaaS teams with 10–100 people"
              />
            </Field>
          </section>
          <section className="space-y-4 border-t pt-6">
            <p className="text-sm font-medium">Pricing and terms</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pricing model">
                <Select
                  value={form.watch("pricingModel")}
                  onValueChange={(value) =>
                    form.setValue("pricingModel", value as Values["pricingModel"], { shouldDirty: true })
                  }
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom pricing</SelectItem>
                    <SelectItem value="fixed">Fixed price</SelectItem>
                    <SelectItem value="starting_at">Starting at</SelectItem>
                    <SelectItem value="usage_based">Usage based</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Price"
                error={form.formState.errors.priceAmount?.message}
              >
                <Input
                  {...form.register("priceAmount")}
                  inputMode="decimal"
                  placeholder="1,500"
                />
              </Field>
            </div>
            <Field label="Currency">
              <Input
                {...form.register("priceCurrency")}
                maxLength={3}
                placeholder="USD"
              />
            </Field>
            <Field label="Offer terms">
              <Textarea
                {...form.register("offerTerms")}
                rows={2}
                placeholder="e.g. Annual plan, billed monthly"
              />
            </Field>
          </section>
          <section className="space-y-4 border-t pt-6">
            <p className="text-sm font-medium">Sales context</p>
            <Field
              label="Qualification constraints"
              hint="Who is this not a fit for?"
            >
              <Textarea
                {...form.register("qualificationConstraints")}
                rows={2}
                placeholder="e.g. Teams without a CRM are not yet a fit"
              />
            </Field>
            <Field label="Proof points" hint="One proof point per line">
              <Textarea
                {...form.register("proofPoints")}
                rows={3}
                placeholder={
                  "Helped Acme reduce sales cycles by 30%\nSOC 2 Type II certified"
                }
              />
            </Field>
          </section>
        </form>
        <SheetFooter className="border-t bg-muted/30 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={closeSheet}>
            Cancel
          </Button>
          <Button type="submit" form="product-form">
            {product ? "Save changes" : "Add product"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
function toDatabaseShape(values: Record<string, unknown>) {
  const source = values as Values & {
    benefits: string[];
    proofPoints: string[];
    priceAmount: number | null;
    priceCurrency: string | null;
    idealCustomer: string | null;
    offerTerms: string | null;
    qualificationConstraints: string | null;
  };
  return {
    ideal_customer: source.idealCustomer,
    pricing_model: source.pricingModel,
    price_amount: source.priceAmount,
    price_currency: source.priceCurrency,
    offer_terms: source.offerTerms,
    qualification_constraints: source.qualificationConstraints,
    benefits: source.benefits,
    proof_points: source.proofPoints,
  };
}
