import { GoogleGenAI } from "@google/genai";

export type ReplyOutcome = "positive_reply" | "meeting_intent" | "conversion_intent" | "objection" | "neutral";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function routeInboundReply(message: string): Promise<{ outcome: ReplyOutcome; confidence: number }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Classify this inbound sales reply. Use the record_reply_outcome tool exactly once. Do not infer a meeting or conversion without explicit evidence.\n\nReply:\n${message.slice(0, 8_000)}`,
    config: { tools: [{ functionDeclarations: [{ name: "record_reply_outcome", description: "Record the reply outcome for safe workflow routing.", parameters: { type: "OBJECT", properties: { outcome: { type: "STRING", enum: ["positive_reply", "meeting_intent", "conversion_intent", "objection", "neutral"] }, confidence: { type: "NUMBER" } }, required: ["outcome", "confidence"] } }] as never }], maxOutputTokens: 256 },
  });
  const call = response.candidates?.[0]?.content?.parts?.map((part) => (part as { functionCall?: { name: string; args: Record<string, unknown> } }).functionCall).find(Boolean);
  if (!call || call.name !== "record_reply_outcome") return { outcome: "neutral", confidence: 0 };
  const outcome = call.args.outcome;
  const allowed: ReplyOutcome[] = ["positive_reply", "meeting_intent", "conversion_intent", "objection", "neutral"];
  return { outcome: allowed.includes(outcome as ReplyOutcome) ? outcome as ReplyOutcome : "neutral", confidence: Math.max(0, Math.min(1, Number(call.args.confidence) || 0)) };
}
