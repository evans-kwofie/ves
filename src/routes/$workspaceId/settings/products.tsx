import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontalIcon, PlusSignIcon } from "hugeicons-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  ProductSheet,
  type ProductEditorProduct,
} from "~/components/modules/products/ProductSheet";
import { useProductSheet } from "~/store/product-sheet";

export const Route = createFileRoute("/$workspaceId/settings/products")({
  component: ProductsPage,
});
type Product = ProductEditorProduct & { created_at?: string };
function asList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}
function priceLabel(product: Product) {
  if (product.pricing_model === "custom" || !product.pricing_model)
    return "Custom pricing";
  if (product.pricing_model === "usage_based") return "Usage based";
  if (product.price_amount == null)
    return product.pricing_model === "starting_at"
      ? "Starting at"
      : "Fixed price";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.price_currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(Number(product.price_amount));
  return product.pricing_model === "starting_at" ? `From ${amount}` : amount;
}

function ProductsPage() {
  const { workspaceId } = Route.useParams();
  const openSheet = useProductSheet((state) => state.openSheet);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);
  React.useEffect(() => {
    void load();
  }, [workspaceId]);
  async function load() {
    setLoading(true);
    const response = await fetch(`/api/products?organizationId=${workspaceId}`);
    if (response.ok) setProducts(await response.json());
    else toast.error("Could not load products");
    setLoading(false);
  }
  function addProduct() {
    setEditing(null);
    openSheet();
  }
  function editProduct(product: Product) {
    setEditing(product);
    openSheet();
  }
  async function deleteProduct() {
    if (!deleting) return;
    const response = await fetch(`/api/products/${deleting.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return toast.error("Could not delete product");
    setProducts((items) => items.filter((item) => item.id !== deleting.id));
    setDeleting(null);
    toast.success("Product deleted");
  }
  function saveProduct(product: ProductEditorProduct) {
    setProducts((items) => {
      const existing = items.findIndex((item) => item.id === product.id);
      return existing < 0
        ? [...items, product]
        : items.map((item) =>
            item.id === product.id ? { ...item, ...product } : item,
          );
    });
  }
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The offers your outreach can confidently talk about.
          </p>
        </div>
        {products?.length > 0 && (
          <Button onClick={addProduct}>
            <PlusSignIcon size={16} /> Add product
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading products…</p>
      ) : products.length === 0 ? (
        <EmptyProducts onAdd={addProduct} />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-base font-semibold">{product.name}</h2>
                    <span className="text-sm text-muted-foreground">
                      {priceLabel(product)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {product.description}
                  </p>
                </div>
                <Actions
                  onEdit={() => editProduct(product)}
                  onDelete={() => setDeleting(product)}
                />
              </div>
              {asList(product.benefits).length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What customers get
                  </p>
                  <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    {asList(product.benefits)
                      .slice(0, 4)
                      .map((benefit) => (
                        <li key={benefit}>• {benefit}</li>
                      ))}
                  </ul>
                </div>
              )}
              {product.ideal_customer && (
                <p className="mt-4 text-sm">
                  <span className="font-medium">Best for </span>
                  <span className="text-muted-foreground">
                    {product.ideal_customer}
                  </span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <ProductSheet
        organizationId={workspaceId}
        product={editing}
        onSaved={saveProduct}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete product?"
        description={`This will permanently remove ${deleting?.name ?? "this product"} from your outreach context.`}
        confirmLabel="Delete product"
        onConfirm={deleteProduct}
      />
    </div>
  );
}
function Actions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" aria-label="Product actions">
          <MoreHorizontalIcon size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit product</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          Delete product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function EmptyProducts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className=" px-6 py-16 text-center">
      <h2 className="text-base font-medium">Add your first offering</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Pricing, benefits, and proof points give the agent the detail it needs
        for relevant outreach.
      </p>
      <Button className="mt-5" onClick={onAdd}>
        <PlusSignIcon size={16} /> Add product
      </Button>
    </div>
  );
}
