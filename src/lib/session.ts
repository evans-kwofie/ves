import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  console.log("[session] cookie header:", headers.get?.("cookie") ?? "(none)");
  const session = await auth.api.getSession({ headers });
  console.log("[session] result:", session ? `user=${session.user.email}` : "null");
  return session;
});
