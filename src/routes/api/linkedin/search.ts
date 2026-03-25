import { createFileRoute } from "@tanstack/react-router";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { LinkedInLeadResult } from "~/types/linkedin";

const requestSchema = z.object({
  keyword: z.string().min(1).max(200),
});

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
});

export const Route = createFileRoute("/api/linkedin/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = requestSchema.safeParse(body);
        console.log("request body", parsed);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: parsed.error.flatten() }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { keyword } = parsed.data;

        const prompt = `
        Find 5-8 B2B SaaS companies related to "${keyword}" that are likely to benefit from tools in this space.

        Prioritize:
        - Recently active or growing companies
        - Clear SaaS business models
        - Founders or CEOs with a visible online presence

        Return a JSON array with:
        - company: company name
        - name: founder or CEO name
        - role: their role (e.g. CEO, Co-founder)
        - whatTheyDo: one clear, specific sentence (no fluff)
        - website: official company website
        - linkedinHint: best guess of their LinkedIn name/slug (NOT a full URL)

        Rules:
        - Do NOT hallucinate exact LinkedIn URLs
        - Keep answers realistic and verifiable
        - No markdown, only JSON
        `;

        const requestParams: Record<string, unknown> = {
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          tools: [
            {
              type: "web_search_20260209" as const,
              name: "web_search" as const,
            },
          ],
          messages: [{ role: "user", content: prompt }],
        };

        const response = await client.messages.create(
          requestParams as unknown as Anthropic.MessageCreateParamsNonStreaming,
        );
        console.log("agent response ", response);

        // Extract text from response
        let rawText = "";
        for (const block of response.content) {
          if (block.type === "text") {
            rawText += block.text;
          }
        }

        // Parse JSON from response
        let results: LinkedInLeadResult[] = [];
        try {
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as unknown[];
            results = parsed
              .filter(
                (item): item is LinkedInLeadResult =>
                  typeof item === "object" &&
                  item !== null &&
                  "company" in item &&
                  "name" in item,
              )
              .map((item) => ({
                company: String((item as LinkedInLeadResult).company ?? ""),
                name: String((item as LinkedInLeadResult).name ?? ""),
                linkedinUrl: String(
                  (item as LinkedInLeadResult).linkedinUrl ?? "",
                ),
                whatTheyDo: String(
                  (item as LinkedInLeadResult).whatTheyDo ?? "",
                ),
                website: String((item as LinkedInLeadResult).website ?? ""),
              }));
          }
        } catch {
          // return empty if parse fails
        }

        return Response.json({ results });
      },
    },
  },
});
