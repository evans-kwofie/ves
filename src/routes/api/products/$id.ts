import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "~/db/client";

const updateSchema = z.object({
  name: z.string().min(1).optional(), description: z.string().min(1).optional(), benefits: z.array(z.string()).optional(), idealCustomer: z.string().nullable().optional(),
  pricingModel: z.enum(["custom", "fixed", "starting_at", "usage_based"]).optional(), priceAmount: z.number().nonnegative().nullable().optional(), priceCurrency: z.string().length(3).nullable().optional(),
  offerTerms: z.string().nullable().optional(), qualificationConstraints: z.string().nullable().optional(), proofPoints: z.array(z.string()).optional(),
});
export const Route = createFileRoute("/api/products/$id")({ server: { handlers: {
  PUT: async ({ params, request }) => {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422 });
    const fields: string[] = ["updated_at = ?"]; const args: unknown[] = [new Date().toISOString()]; const data = parsed.data;
    if (data.name !== undefined) { fields.push("name = ?"); args.push(data.name); }
    if (data.description !== undefined) { fields.push("description = ?"); args.push(data.description); }
    if (data.benefits !== undefined) { fields.push("benefits = ?"); args.push(JSON.stringify(data.benefits)); }
    if (data.idealCustomer !== undefined) { fields.push("ideal_customer = ?"); args.push(data.idealCustomer); }
    if (data.pricingModel !== undefined) { fields.push("pricing_model = ?"); args.push(data.pricingModel); }
    if (data.priceAmount !== undefined) { fields.push("price_amount = ?"); args.push(data.priceAmount); }
    if (data.priceCurrency !== undefined) { fields.push("price_currency = ?"); args.push(data.priceCurrency?.toUpperCase() ?? null); }
    if (data.offerTerms !== undefined) { fields.push("offer_terms = ?"); args.push(data.offerTerms); }
    if (data.qualificationConstraints !== undefined) { fields.push("qualification_constraints = ?"); args.push(data.qualificationConstraints); }
    if (data.proofPoints !== undefined) { fields.push("proof_points = ?"); args.push(JSON.stringify(data.proofPoints)); }
    args.push(params.id); await db.execute({ sql: `UPDATE product_profiles SET ${fields.join(", ")} WHERE id = ?`, args });
    return Response.json({ ok: true });
  },
  DELETE: async ({ params }) => { await db.execute({ sql: "DELETE FROM product_profiles WHERE id = ?", args: [params.id] }); return new Response(null, { status: 204 }); },
} } });
