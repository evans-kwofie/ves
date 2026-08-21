import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { geminiJSON } from "~/agent/tools/gemini";
import { createBusinessMaterial, getBusinessMaterialSummary, type BusinessMaterialProfile } from "~/db/queries/business-materials";

const profileSchema = z.object({ positioning: z.array(z.string().max(300)).max(8).default([]), terminology: z.array(z.string().max(100)).max(16).default([]), proofPoints: z.array(z.string().max(300)).max(10).default([]), idealCustomers: z.array(z.string().max(250)).max(8).default([]), problemsSolved: z.array(z.string().max(250)).max(8).default([]), voice: z.array(z.string().max(150)).max(8).default([]) });

async function extractProfile(text: string): Promise<BusinessMaterialProfile> {
  const result = await geminiJSON<unknown>(`Extract only claims explicitly supported by this business material. Preserve important customer terminology verbatim. Do not invent proof, customers, or metrics.\n\nMaterial:\n${text.slice(0, 30_000)}`, { maxTokens: 1_500, thinkingBudget: 0, responseJsonSchema: { type: "object", properties: { positioning: { type: "array" }, terminology: { type: "array" }, proofPoints: { type: "array" }, idealCustomers: { type: "array" }, problemsSolved: { type: "array" }, voice: { type: "array" } }, required: ["positioning", "terminology", "proofPoints", "idealCustomers", "problemsSolved", "voice"] } });
  return profileSchema.parse(result);
}

export const Route = createFileRoute("/api/workspace/materials")({ server: { handlers: {
  GET: async ({ request }) => { const organizationId = new URL(request.url).searchParams.get("organizationId"); return organizationId ? Response.json(await getBusinessMaterialSummary(organizationId)) : Response.json({ error: "organizationId required" }, { status: 400 }); },
  POST: async ({ request }) => {
    const form = await request.formData(); const organizationId = String(form.get("organizationId") ?? ""); const name = String(form.get("name") ?? "").trim(); const pastedText = String(form.get("text") ?? "").trim(); const file = form.get("file");
    if (!organizationId || !name) return Response.json({ error: "organizationId and name are required" }, { status: 400 });
    let rawText = pastedText; let sourceType: "paste" | "document" | "pdf" = "paste";
    if (file instanceof File) {
      sourceType = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "document";
      if (file.size > 10_000_000) return Response.json({ error: "Files must be 10 MB or smaller" }, { status: 413 });
      if (sourceType === "pdf") { const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) }); try { rawText = (await parser.getText()).text; } finally { await parser.destroy(); } } else rawText = await file.text();
    }
    if (rawText.trim().length < 30) return Response.json({ error: "Provide at least 30 characters of readable material" }, { status: 422 });
    const extractedProfile = await extractProfile(rawText);
    return Response.json(await createBusinessMaterial({ organizationId, name, sourceType, rawText: rawText.slice(0, 60_000), extractedProfile }));
  },
} } });
