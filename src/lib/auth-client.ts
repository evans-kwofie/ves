import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
