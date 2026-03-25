import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzleDb } from "~/db/drizzle";
import * as authSchema from "~/db/auth-schema";

console.log("[auth] secret loaded:", process.env.BETTER_AUTH_SECRET ? `${process.env.BETTER_AUTH_SECRET.slice(0, 6)}...` : "MISSING");
console.log("[auth] baseURL:", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(drizzleDb, {
    provider: "sqlite",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
