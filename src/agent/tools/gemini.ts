import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_MODEL = "gemini-2.5-flash";

export async function geminiComplete(
  prompt: string,
  opts?: { model?: string; maxTokens?: number; system?: string },
): Promise<string> {
  const response = await ai.models.generateContent({
    model: opts?.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      ...(opts?.system ? { systemInstruction: opts.system } : {}),
      ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  });
  return response.text ?? "";
}

export async function geminiSearch(
  prompt: string,
  opts?: { model?: string; maxTokens?: number },
): Promise<string> {
  const response = await ai.models.generateContent({
    model: opts?.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  });
  return response.text ?? "";
}

export async function geminiJSON<T>(
  prompt: string,
  opts?: { model?: string; maxTokens?: number; system?: string },
): Promise<T> {
  const response = await ai.models.generateContent({
    model: opts?.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(opts?.system ? { systemInstruction: opts.system } : {}),
      ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  });
  const raw = response.text ?? "";
  console.log("[geminiJSON] raw response length:", raw.length);
  console.log("[geminiJSON] raw response:", raw.slice(0, 500));
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[geminiJSON] JSON parse failed:", err);
    console.error("[geminiJSON] full raw response:", raw);
    throw err;
  }
}
