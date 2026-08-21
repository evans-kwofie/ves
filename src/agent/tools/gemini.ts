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
  opts?: {
    model?: string;
    maxTokens?: number;
    system?: string;
    thinkingBudget?: number;
    /** Constrains the model response beyond JSON mode when the shape is known. */
    responseJsonSchema?: unknown;
  },
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await ai.models.generateContent({
      model: opts?.model ?? DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        ...(opts?.responseJsonSchema ? { responseJsonSchema: opts.responseJsonSchema } : {}),
        ...(opts?.system ? { systemInstruction: opts.system } : {}),
        ...(opts?.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts?.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
      },
    });

    try {
      return JSON.parse(response.text ?? "{}") as T;
    } catch (error) {
      if (attempt === 1 || !(error instanceof SyntaxError)) throw error;
    }
  }

  // The loop either returns a parsed response or throws on its final attempt.
  throw new Error("Unreachable Gemini JSON parse state");
}
