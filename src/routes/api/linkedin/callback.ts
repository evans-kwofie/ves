import { createFileRoute } from "@tanstack/react-router";
import { db } from "~/db/client";

export const Route = createFileRoute("/api/linkedin/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const origin = reqUrl.origin;
        const { searchParams } = reqUrl;

        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error || !code || !state) {
          return Response.redirect(`${origin}/?linkedin_error=cancelled`, 302);
        }

        // State encodes workspaceId:randomToken
        const [workspaceId] = state.split(":");
        if (!workspaceId) {
          return new Response("Invalid state", { status: 400 });
        }

        // Exchange code for access token
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
            redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:3000/api/linkedin/callback/",
          }),
        });

        if (!tokenRes.ok) {
          console.error("[linkedin/callback] token exchange failed", await tokenRes.text());
          return Response.redirect(`${origin}/${workspaceId}/settings/integrations?linkedin_error=token`, 302);
        }

        const tokenData = (await tokenRes.json()) as {
          access_token: string;
          expires_in: number;
        };

        // Fetch member profile via OpenID userinfo endpoint
        const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const profile = profileRes.ok
          ? (await profileRes.json()) as { sub: string; name?: string; email?: string; picture?: string }
          : { sub: "", name: "", email: "", picture: "" };

        console.log("[linkedin/callback] connected", profile.name, profile.sub);

        // Store token in org metadata
        const result = await db.execute({
          sql: "SELECT metadata FROM organization WHERE id = ? OR slug = ?",
          args: [workspaceId, workspaceId],
        });

        const row = result.rows[0];
        let meta: Record<string, string> = {};
        try { meta = row?.metadata ? JSON.parse(row.metadata as string) : {}; } catch {}

        const expiresAt = Date.now() + tokenData.expires_in * 1000;
        const newMeta = {
          ...meta,
          linkedinAccessToken: tokenData.access_token,
          linkedinMemberId: profile.sub,
          linkedinDisplayName: profile.name ?? "",
          linkedinPicture: profile.picture ?? "",
          linkedinTokenExpiry: String(expiresAt),
        };

        await db.execute({
          sql: "UPDATE organization SET metadata = ? WHERE id = ? OR slug = ?",
          args: [JSON.stringify(newMeta), workspaceId, workspaceId],
        });

        return Response.redirect(`${origin}/${workspaceId}/settings/integrations?linkedin_connected=1`, 302);
      },
    },
  },
});
