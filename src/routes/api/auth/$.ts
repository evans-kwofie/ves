import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";

async function handleAuth(request: Request): Promise<Response> {
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
