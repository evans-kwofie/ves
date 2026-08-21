export function checkDraftQuality(input: { body: string; channel: string; prospect?: { company?: string; firstName?: string; whatTheyDo?: string } }): string[] {
  const body = input.body.trim();
  const issues: string[] = [];
  if (/^(hi|hello|hey)[,!]?\s*(there|i hope)/i.test(body)) issues.push("Generic opening");
  if (input.channel === "instagram" && body.length > 1000) issues.push("Over Instagram's 1,000-character limit");
  if (input.channel === "linkedin_connect" && body.length > 300) issues.push("Over LinkedIn's 300-character limit");
  if (input.channel === "email" && /\b(guaranteed|act now|free money|risk[- ]free)\b/i.test(body)) issues.push("Possible spam-risk wording");
  if (!/\?|\b(reply|share|chat|call|connect|send|open to)\b/i.test(body)) issues.push("No clear CTA");
  const sentences = body.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const words = body.match(/\b[\p{L}\p{N}'’-]+\b/gu) ?? [];
  if (sentences.length && words.length / sentences.length > 28) issues.push("Hard to scan — shorten long sentences");
  const longestSentence = Math.max(0, ...sentences.map((sentence) => sentence.match(/\b[\p{L}\p{N}'’-]+\b/gu)?.length ?? 0));
  if (longestSentence > 36 && !issues.includes("Hard to scan — shorten long sentences")) issues.push("Hard to scan — shorten long sentences");
  const denseWordCount = words.filter((word) => word.replace(/[^\p{L}]/gu, "").length >= 13).length;
  if (denseWordCount >= 3) issues.push("Dense wording — prefer plainer language");
  if (words.length > 90 && !/\n\s*\n/.test(body)) issues.push("Long block of copy — add a paragraph break");
  if (input.channel === "email" && words.length > 150) issues.push("Long for a cold email — tighten the message");
  const prospectText = `${input.prospect?.company ?? ""} ${input.prospect?.firstName ?? ""} ${input.prospect?.whatTheyDo ?? ""}`.toLowerCase();
  const prospectWords = [...new Set(prospectText.match(/[a-z]{4,}/g) ?? [])].filter((word) => !["that", "with", "from", "your", "their", "this", "they", "have", "about"].includes(word));
  if (prospectWords.length && !prospectWords.some((word) => body.toLowerCase().includes(word))) issues.push("No prospect-specific context");
  return issues;
}
