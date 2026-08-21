import { db } from "../client";
import type { ProductProfile } from "~/lib/product-matching";

export async function listProductProfiles(organizationId: string): Promise<ProductProfile[]> {
  const result = await db.execute({ sql: "SELECT * FROM product_profiles WHERE organization_id = ? ORDER BY created_at ASC", args: [organizationId] });
  return result.rows.map((row) => {
    const value = row as Record<string, unknown>;
    let benefits: string[] = [];
    try { benefits = typeof value.benefits === "string" ? JSON.parse(value.benefits) as string[] : value.benefits as string[] ?? []; } catch { /* use empty */ }
    return { id: value.id as string, name: value.name as string, description: value.description as string, benefits, idealCustomer: value.ideal_customer as string | null };
  });
}
