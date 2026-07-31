import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_MODEL = "gemini-2.5-flash";

export async function geminiComplete(
  prompt: string,
  opts?: { model?: string; maxTokens?: number; system?: string; thinkingBudget?: number },
): Promise<string> {
  const response = await ai.models.generateContent({
    model: opts?.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      ...(opts?.system ? { systemInstruction: opts.system } : {}),
      ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      // thinkingBudget: 0 disables thinking tokens so they don't consume the output budget
      ...(opts?.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
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
  opts?: { model?: string; maxTokens?: number; system?: string; thinkingBudget?: number },
): Promise<T> {
  const response = await ai.models.generateContent({
    model: opts?.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(opts?.system ? { systemInstruction: opts.system } : {}),
      ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts?.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
    },
  });
  return JSON.parse(response.text ?? "{}") as T;
}
