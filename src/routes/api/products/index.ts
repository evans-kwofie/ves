import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/db/client";

const productSchema = z.object({ organizationId: z.string().min(1), name: z.string().min(1), description: z.string().min(1), benefits: z.array(z.string()).default([]), idealCustomer: z.string().nullable().optional(), pricingModel: z.enum(["custom", "fixed", "starting_at", "usage_based"]).default("custom"), priceAmount: z.number().nonnegative().nullable().optional(), priceCurrency: z.string().length(3).nullable().optional(), offerTerms: z.string().nullable().optional(), qualificationConstraints: z.string().nullable().optional(), proofPoints: z.array(z.string()).default([]) });

export const Route = createFileRoute("/api/products/")({ server: { handlers: {
  GET: async ({ request }) => {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return new Response(JSON.stringify({ error: "organizationId_required" }), { status: 400 });
    const result = await db.execute({ sql: "SELECT * FROM product_profiles WHERE organization_id = ? ORDER BY created_at ASC", args: [organizationId] });
    return Response.json(result.rows);
  },
  POST: async ({ request }) => {
    const parsed = productSchema.safeParse(await request.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422 });
    const id = uuidv4(); const now = new Date().toISOString(); const data = parsed.data;
    await db.execute({ sql: "INSERT INTO product_profiles (id, organization_id, name, description, benefits, ideal_customer, pricing_model, price_amount, price_currency, offer_terms, qualification_constraints, proof_points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, data.organizationId, data.name, data.description, JSON.stringify(data.benefits), data.idealCustomer ?? null, data.pricingModel, data.priceAmount ?? null, data.priceCurrency?.toUpperCase() ?? null, data.offerTerms ?? null, data.qualificationConstraints ?? null, JSON.stringify(data.proofPoints), now, now] });
    return Response.json({ id, ...data, createdAt: now });
  },
} } });
