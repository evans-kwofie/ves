#!/usr/bin/env npx tsx
/**
 * Generates test CSV files for the lead import modal.
 * Usage: npx tsx scripts/generate-test-csvs.ts
 *
 * Output:
 *   scripts/test-leads-valid.csv       — clean, all fields present
 *   scripts/test-leads-mixed.csv       — some valid, some missing required fields
 *   scripts/test-leads-minimal.csv     — only required columns (company + contact)
 *   scripts/test-leads-bad-headers.csv — weird column names to test auto-mapping
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OUT = join(import.meta.dirname);

function csv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (cell.includes(",") || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(",")
    )
    .join("\n");
}

// ── 1. Valid CSV — all fields, clean data ─────────────────────────────────────

const valid = csv([
  ["Company", "Contact", "Email", "Website", "Description", "Notes"],
  ["Vercel", "Guillermo Rauch", "guillermo@vercel.com", "https://vercel.com", "Frontend cloud platform for deploying web apps", "Reached out via Twitter, very responsive"],
  ["Resend", "Zeno Rocha", "zeno@resend.com", "https://resend.com", "Email API for developers built on top of AWS SES", "Great ICP fit, uses React Email"],
  ["Neon", "Nikita Shamgunov", "nikita@neon.tech", "https://neon.tech", "Serverless Postgres with branching and autoscale", "Competing with PlanetScale"],
  ["Railway", "Jake Cooper", "jake@railway.app", "https://railway.app", "Infrastructure platform for deploying full-stack apps", "Small team, fast movers"],
  ["Trigger.dev", "Matt Aitken", "matt@trigger.dev", "https://trigger.dev", "Background jobs and workflow automation for developers", "OSS, growing fast"],
  ["Inngest", "Dan Farrelly", "dan@inngest.com", "https://inngest.com", "Event-driven workflow engine for serverless functions", "Similar to Trigger.dev"],
  ["Planetscale", "Sam Lambert", "sam@planetscale.com", "https://planetscale.com", "MySQL-compatible serverless database platform", "Big enterprise deals"],
  ["Turso", "Glauber Costa", "glauber@turso.tech", "https://turso.tech", "Edge SQLite database powered by libSQL", "Strong dev community"],
]);

writeFileSync(join(OUT, "test-leads-valid.csv"), valid);
console.log("✓ test-leads-valid.csv — 8 clean rows");

// ── 2. Mixed CSV — some valid, some missing required fields ───────────────────

const mixed = csv([
  ["Company", "Contact", "Email", "Website", "Description", "Notes"],
  ["Linear", "Karri Saarinen", "karri@linear.app", "https://linear.app", "Issue tracking tool built for modern software teams", "High fit"],
  // missing contact
  ["Loom", "", "support@loom.com", "https://loom.com", "Async video messaging for teams", ""],
  ["Cal.com", "Peer Richelsen", "peer@cal.com", "https://cal.com", "Open source scheduling infrastructure", "OSS play"],
  // missing company
  ["", "Tom Preston-Werner", "tom@toml.io", "https://toml.io", "Config language creator", ""],
  ["Supabase", "Paul Copplestone", "paul@supabase.com", "https://supabase.com", "Open source Firebase alternative", "Series B"],
  // missing both required fields
  ["", "", "noreply@example.com", "https://example.com", "Unknown company", ""],
  ["Fly.io", "Kurt Mackey", "kurt@fly.io", "https://fly.io", "App deployment close to users worldwide", "Strong eng culture"],
  // missing contact
  ["Clerk", "", "hello@clerk.com", "https://clerk.com", "Authentication and user management for React apps", ""],
]);

writeFileSync(join(OUT, "test-leads-mixed.csv"), mixed);
console.log("✓ test-leads-mixed.csv — 5 valid, 3 invalid rows");

// ── 3. Minimal CSV — only required columns ────────────────────────────────────

const minimal = csv([
  ["Company", "Contact"],
  ["Stripe", "Patrick Collison"],
  ["Notion", "Ivan Zhao"],
  ["Figma", "Dylan Field"],
  ["Retool", "David Haber"],
  ["Temporal", "Maxim Fateev"],
]);

writeFileSync(join(OUT, "test-leads-minimal.csv"), minimal);
console.log("✓ test-leads-minimal.csv — 5 rows, required columns only");

// ── 4. Weird headers — tests auto-mapping heuristics ─────────────────────────

const weirdHeaders = csv([
  ["Account Name", "CEO / Founder", "Business Email", "Company URL", "What do they do?", "Internal Notes"],
  ["PostHog", "James Hawkins", "james@posthog.com", "https://posthog.com", "Open source product analytics", "OSS, series C"],
  ["Dub.co", "Steven Tey", "steven@dub.co", "https://dub.co", "Link management for modern marketing teams", "Solo founder"],
  ["Mintlify", "Han Wang", "han@mintlify.com", "https://mintlify.com", "Beautiful docs that convert more users", "YC S22"],
]);

writeFileSync(join(OUT, "test-leads-bad-headers.csv"), weirdHeaders);
console.log("✓ test-leads-bad-headers.csv — 3 rows, non-standard column names");

console.log("\nAll test CSVs written to scripts/");
