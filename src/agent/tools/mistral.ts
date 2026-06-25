import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

/**
 * Lightweight utility wrapper around Mistral for fast, cheap tasks —
 * classifications, scoring, short extractions, copy tweaks.
 * Use Claude for anything that needs reasoning or tool calls.
 *
 * Models:
 *   "mistral-small-latest"  — fastest, cheapest, good for classification
 *   "mistral-large-latest"  — more capable, still cheaper than Claude Sonnet
 */

export type MistralModel = "mistral-small-latest" | "mistral-large-latest";

export async function mistralComplete(
  prompt: string,
  opts: {
    system?: string;
    model?: MistralModel;
    maxTokens?: number;
    json?: boolean;
  } = {},
): Promise<string> {
  const {
    system,
    model = "mistral-small-latest",
    maxTokens = 256,
    json = false,
  } = opts;

  const response = await client.chat.complete({
    model,
    maxTokens,
    ...(json ? { responseFormat: { type: "json_object" } } : {}),
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

  return response.choices?.[0]?.message?.content as string ?? "";
}

/**
 * Parse JSON from a Mistral response safely.
 * Pass json: true in opts to get guaranteed JSON mode.
 */
export async function mistralJSON<T>(
  prompt: string,
  opts: { system?: string; model?: MistralModel; maxTokens?: number } = {},
): Promise<T | null> {
  try {
    const text = await mistralComplete(prompt, { ...opts, json: true });
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
