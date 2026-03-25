import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { resolve } from "path";

// Ensure the data directory exists before libsql tries to open the file
const url = process.env.LIBSQL_URL ?? "file:./data/vesper.db";
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  const dir = resolve(process.cwd(), filePath, "..");
  mkdirSync(dir, { recursive: true });
}

export const db = createClient({
  url,
  authToken: process.env.LIBSQL_AUTH_TOKEN,
});
