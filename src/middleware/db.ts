import { createMiddleware } from "@tanstack/react-start";
import { initDb } from "~/db/schema";

let initialized: Promise<void> | null = null;

export const dbMiddleware = createMiddleware().server(async ({ next }) => {
  if (!initialized) initialized = initDb();
  await initialized;
  return next();
});
