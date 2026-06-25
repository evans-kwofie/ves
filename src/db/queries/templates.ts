import { db } from "../client";
import { v4 as uuidv4 } from "uuid";

export interface Template {
  id: string;
  organizationId: string;
  name: string;
  channel: "email" | "linkedin" | "instagram";
  subject: string | null;
  body: string;
  brandColor: string | null;
  showLogo: boolean;
  variantBSubject: string | null;
  variantBBody: string | null;
  createdAt: string;
  updatedAt: string;
}

type TemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  brand_color: string | null;
  show_logo: number;
  variant_b_subject: string | null;
  variant_b_body: string | null;
  created_at: string;
  updated_at: string;
};

function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    channel: row.channel as Template["channel"],
    subject: row.subject,
    body: row.body,
    brandColor: row.brand_color,
    showLogo: row.show_logo === 1,
    variantBSubject: row.variant_b_subject ?? null,
    variantBBody: row.variant_b_body ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTemplate(id: string): Promise<Template | null> {
  const rows = await db.execute({
    sql: "SELECT * FROM templates WHERE id = ? LIMIT 1",
    args: [id],
  });
  if (rows.rows.length === 0) return null;
  return toTemplate(rows.rows[0] as unknown as TemplateRow);
}

export async function listTemplates(orgId: string): Promise<Template[]> {
  const rows = await db.execute({
    sql: "SELECT * FROM templates WHERE organization_id = ? ORDER BY created_at DESC",
    args: [orgId],
  });
  return (rows.rows as unknown as TemplateRow[]).map(toTemplate);
}

export async function createTemplate(data: {
  organizationId: string;
  name: string;
  channel: string;
  subject?: string | null;
  body: string;
  brandColor?: string | null;
  showLogo?: boolean;
  variantBSubject?: string | null;
  variantBBody?: string | null;
}): Promise<Template> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO templates
      (id, organization_id, name, channel, subject, body, brand_color, show_logo, variant_b_subject, variant_b_body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, data.organizationId, data.name, data.channel,
      data.subject ?? null, data.body,
      data.brandColor ?? null, data.showLogo !== false ? 1 : 0,
      data.variantBSubject ?? null, data.variantBBody ?? null,
      now, now,
    ],
  });
  return (await listTemplates(data.organizationId)).find((t) => t.id === id)!;
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    channel?: string;
    subject?: string | null;
    body?: string;
    brandColor?: string | null;
    showLogo?: boolean;
    variantBSubject?: string | null;
    variantBBody?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const args: unknown[] = [now];

  if (data.name !== undefined)          { sets.push("name = ?");              args.push(data.name); }
  if (data.channel !== undefined)       { sets.push("channel = ?");           args.push(data.channel); }
  if ("subject" in data)                { sets.push("subject = ?");           args.push(data.subject ?? null); }
  if (data.body !== undefined)          { sets.push("body = ?");              args.push(data.body); }
  if ("brandColor" in data)             { sets.push("brand_color = ?");       args.push(data.brandColor ?? null); }
  if (data.showLogo !== undefined)      { sets.push("show_logo = ?");         args.push(data.showLogo ? 1 : 0); }
  if ("variantBSubject" in data)        { sets.push("variant_b_subject = ?"); args.push(data.variantBSubject ?? null); }
  if ("variantBBody" in data)           { sets.push("variant_b_body = ?");    args.push(data.variantBBody ?? null); }

  args.push(id);
  await db.execute({ sql: `UPDATE templates SET ${sets.join(", ")} WHERE id = ?`, args });
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM templates WHERE id = ?", args: [id] });
}
