# AI model strategy

## Decision

Nextreach uses Google Gemini as the primary model provider for structured lead enrichment and channel-aware outreach drafting.

The current default is `gemini-2.5-flash`, selected for low-latency generation with JSON-mode support. The roadmap's earlier Claude reference is not the active implementation choice.

## Boundaries

- The model proposes copy and enrichment; deterministic application code validates schemas, channel limits, scores, and send safeguards.
- Pricing-page imports extract only offers evidenced by page text and remain editable before future outreach uses them.
- No outbound message is sent by model output alone: email requires review/send action, while LinkedIn and Instagram remain manual-send workflows.
- Model failures must be surfaced as failed generation or enrichment work, never converted into invented data.

## Change policy

Changing providers or models requires a comparison on structured-output validity, channel compliance, latency, cost, and draft quality. Keep the `geminiJSON` interface as the provider boundary so a future evaluated provider can be introduced without rewriting campaign workflows.
