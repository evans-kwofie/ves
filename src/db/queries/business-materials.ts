import { v4 as uuidv4 } from "uuid";
import { db } from "../client";

export interface BusinessMaterialProfile {
  positioning: string[];
  terminology: string[];
  proofPoints: string[];
  idealCustomers: string[];
  problemsSolved: string[];
  voice: string[];
}

const emptyProfile = (): BusinessMaterialProfile => ({ positioning: [], terminology: [], proofPoints: [], idealCustomers: [], problemsSolved: [], voice: [] });

export async function createBusinessMaterial(input: { organizationId: string; name: string; sourceType: "paste" | "document" | "pdf"; rawText: string; extractedProfile: BusinessMaterialProfile }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.execute({ sql: `INSERT INTO business_materials (id, organization_id, name, source_type, raw_text, extracted_profile, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, args: [id, input.organizationId, input.name, input.sourceType, input.rawText, JSON.stringify(input.extractedProfile), now, now] });
  return { id, ...input, createdAt: now };
}

export async function getBusinessMaterialSummary(organizationId: string): Promise<BusinessMaterialProfile> {
  const result = await db.execute({ sql: "SELECT extracted_profile FROM business_materials WHERE organization_id = ? ORDER BY created_at DESC LIMIT 12", args: [organizationId] });
  const profiles = result.rows.map((row) => {
    try { return typeof (row as Record<string, unknown>).extracted_profile === "string" ? JSON.parse((row as Record<string, unknown>).extracted_profile as string) : (row as Record<string, unknown>).extracted_profile; } catch { return {}; }
  }) as Partial<BusinessMaterialProfile>[];
  const summary = emptyProfile();
  for (const profile of profiles) for (const key of Object.keys(summary) as (keyof BusinessMaterialProfile)[]) {
    for (const value of profile[key] ?? []) if (typeof value === "string" && !summary[key].includes(value)) summary[key].push(value);
  }
  for (const key of Object.keys(summary) as (keyof BusinessMaterialProfile)[]) summary[key] = summary[key].slice(0, 8);
  return summary;
}
