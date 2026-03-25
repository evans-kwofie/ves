import { createFileRoute } from "@tanstack/react-router";
import { getEvent } from "vinxi/http";
import { auth } from "~/lib/auth";

async function handleAuth(request: Request): Promise<Response> {
  const res = await auth.handler(request);

  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];

  console.log(
    "[auth-handler]",
    request.method,
    new URL(request.url).pathname,
    "→ cookies:",
    setCookies.map((c) => c.split(";")[0]),
  );

  if (setCookies.length > 0) {
    // TanStack Start strips Set-Cookie from returned Responses in API route handlers.
    // Forward them via the underlying Vinxi/H3 Node.js response directly.
    const event = getEvent();
    for (const cookie of setCookies) {
      event.node.res.appendHeader("Set-Cookie", cookie);
    }
  }

  // Return response without Set-Cookie (already applied to node res above)
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  return new Response(res.body, { status: res.status, headers });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
