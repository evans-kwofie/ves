import { drizzle } from "drizzle-orm/libsql";
import { db as libsqlClient } from "./client";
import * as authSchema from "./auth-schema";

// Drizzle wrapper around the same libsql client — used exclusively for Better Auth
export const drizzleDb = drizzle(libsqlClient, { schema: authSchema });
