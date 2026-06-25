import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzleDb } from "~/db/drizzle";
import * as authSchema from "~/db/auth-schema";
import { sendEmail } from "~/agent/tools/email";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(drizzleDb, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your Nextreach password",
        body: `Hi ${user.name ?? "there"},\n\nClick the link below to reset your password:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n— Nextreach`,
      });
    },
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
