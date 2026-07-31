import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

export const Route = createFileRoute("/api/linkedin/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const { searchParams } = reqUrl;
        const workspaceId = searchParams.get("workspaceId");
        if (!workspaceId) {
          return new Response("Missing workspaceId", { status: 400 });
        }
        const origin = reqUrl.origin;

        const state = `${workspaceId}:${crypto.randomBytes(16).toString("hex")}`;
        const scope = "openid profile email w_member_social";

        const params = new URLSearchParams({
          response_type: "code",
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3000/api/linkedin/callback/",
          state,
          scope,
        });

        return Response.redirect(
          `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
          302,
        );
      },
    },
  },
});
