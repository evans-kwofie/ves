import { v4 as uuidv4 } from "uuid";
import { db } from "../client";
import type { BlogPost, CreateBlogPostInput, UpdateBlogPostInput } from "~/types/blog";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function rowToPost(row: Record<string, unknown>): BlogPost {
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    content: row.content as string,
    keywords: JSON.parse(row.keywords as string) as string[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listBlogPosts(orgId: string): Promise<BlogPost[]> {
  const result = await db.execute({
    sql: "SELECT * FROM blog_posts WHERE organization_id = ? ORDER BY created_at DESC",
    args: [orgId],
  });
  return result.rows.map((r) => rowToPost(r as Record<string, unknown>));
}

export async function getBlogPost(id: string): Promise<BlogPost | null> {
  const result = await db.execute({ sql: "SELECT * FROM blog_posts WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  return rowToPost(result.rows[0] as Record<string, unknown>);
}

export async function createBlogPost(orgId: string, input: CreateBlogPostInput): Promise<BlogPost> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const baseSlug = slugify(input.title);
  let slug = baseSlug;
  let attempt = 0;

  while (true) {
    const existing = await db.execute({
      sql: "SELECT id FROM blog_posts WHERE slug = ?",
      args: [slug],
    });
    if (existing.rows.length === 0) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  await db.execute({
    sql: `INSERT INTO blog_posts (id, organization_id, title, slug, content, keywords, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, orgId, input.title, slug, input.content, JSON.stringify(input.keywords), now, now],
  });

  return (await getBlogPost(id))!;
}

export async function updateBlogPost(id: string, input: UpdateBlogPostInput): Promise<BlogPost> {
  const now = new Date().toISOString();
  const fields: string[] = ["updated_at = ?"];
  const args: (string)[] = [now];

  if (input.title !== undefined) {
    fields.push("title = ?");
    args.push(input.title);
  }
  if (input.content !== undefined) {
    fields.push("content = ?");
    args.push(input.content);
  }
  if (input.keywords !== undefined) {
    fields.push("keywords = ?");
    args.push(JSON.stringify(input.keywords));
  }

  args.push(id);
  await db.execute({ sql: `UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`, args });

  return (await getBlogPost(id))!;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM blog_posts WHERE id = ?", args: [id] });
}

export async function getBlogPostCount(orgId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM blog_posts WHERE organization_id = ?",
    args: [orgId],
  });
  return (result.rows[0] as Record<string, unknown>).count as number;
}
