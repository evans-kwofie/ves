import { drizzle } from "drizzle-orm/postgres-js";
import { pgClient } from "./client";
import * as authSchema from "./auth-schema";

// Drizzle wrapper around the shared postgres client — used exclusively for Better Auth
export const drizzleDb = drizzle(pgClient, { schema: authSchema });
