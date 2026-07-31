import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "~/db/client";
import { markLinkedInPostPublished } from "~/db/queries/linkedin";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  content: z.string().min(1),
  postId: z.string().optional(), // if provided, marks the DB post as published
});

export const Route = createFileRoute("/api/linkedin/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); }
        catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 }); }

        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 422 });
        }

        const { organizationId, content, postId } = parsed.data;

        // Look up token from org metadata
        const result = await db.execute({
          sql: "SELECT metadata FROM organization WHERE id = ? OR slug = ?",
          args: [organizationId, organizationId],
        });

        const row = result.rows[0];
        let meta: Record<string, string> = {};
        try { meta = row?.metadata ? JSON.parse(row.metadata as string) : {}; } catch {}

        const { linkedinAccessToken, linkedinMemberId } = meta;
        if (!linkedinAccessToken || !linkedinMemberId) {
          return new Response(JSON.stringify({ error: "linkedin_not_connected" }), { status: 401 });
        }

        // Check token expiry
        const expiry = Number(meta.linkedinTokenExpiry ?? 0);
        if (expiry && Date.now() > expiry) {
          return new Response(JSON.stringify({ error: "linkedin_token_expired" }), { status: 401 });
        }

        // Post to LinkedIn UGC Posts API
        const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${linkedinAccessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            author: `urn:li:person:${linkedinMemberId}`,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: content },
                shareMediaCategory: "NONE",
              },
            },
            visibility: {
              "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
          }),
        });

        if (!postRes.ok) {
          const err = await postRes.text();
          console.error("[linkedin/publish] API error", err);
          let errCode = "linkedin_api_error";
          try {
            const parsed = JSON.parse(err) as { code?: string; serviceErrorCode?: number };
            if (parsed.code === "REVOKED_ACCESS_TOKEN" || postRes.status === 401) {
              errCode = "linkedin_token_revoked";
            }
          } catch {}
          return new Response(JSON.stringify({ error: errCode, detail: err }), { status: 502 });
        }

        const linkedinPostId = postRes.headers.get("x-restli-id") ?? "";
        const linkedinPostUrl = linkedinPostId
          ? `https://www.linkedin.com/feed/update/${encodeURIComponent(linkedinPostId)}/`
          : null;
        console.log("[linkedin/publish] posted", linkedinPostId);

        if (postId && linkedinPostId) {
          await markLinkedInPostPublished(postId, linkedinPostId);
        }

        return Response.json({ ok: true, linkedinPostId, linkedinPostUrl });
      },
    },
  },
});
