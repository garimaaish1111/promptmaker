/**
 * Cross-provider cost projection for the *generated* prompt.
 *
 * PromptMaker prices its own pipeline exactly (see `cost.ts` — those numbers
 * come from the Messages API `usage` object). This file answers a different
 * question: "if I paste this optimized prompt into ChatGPT / Claude / Gemini,
 * roughly what will it cost me there?"
 *
 * ── Accuracy warning ────────────────────────────────────────────────────────
 * Only the Anthropic rows are verified against a first-party source. The
 * OpenAI and Google rows are PLACEHOLDERS and are almost certainly stale —
 * third-party model pricing changes often. They are marked `verified: false`
 * and the UI labels them as unverified estimates. Update `ratePerMTok` and
 * `lastChecked` from each provider's own pricing page before trusting them.
 *
 * Token counts are also approximations for non-Anthropic providers. Anthropic
 * token counts come from the real `count_tokens` endpoint; other providers use
 * `tokenRatioVsClaude`, a crude scaling factor. Do not use tiktoken as a stand-in
 * for Claude's tokenizer — it undercounts Claude by roughly 15-20% on prose and
 * considerably more on code.
 */

export type ProviderId = "anthropic" | "openai" | "google";

export interface TargetModel {
  id: string;
  label: string;
  provider: ProviderId;
  inputPerMTok: number;
  outputPerMTok: number;
  /**
   * Multiply a Claude token count by this to approximate this model's
   * tokenizer. 1.0 for Anthropic models (exact, measured).
   */
  tokenRatioVsClaude: number;
  /** False means: shown to the user as an unverified estimate. */
  verified: boolean;
  /** ISO date the rates were last confirmed against the provider. */
  lastChecked: string;
}

export const TARGET_MODELS: TargetModel[] = [
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    provider: "anthropic",
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    tokenRatioVsClaude: 1.0,
    verified: true,
    lastChecked: "2026-06-24",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    tokenRatioVsClaude: 1.0,
    verified: true,
    lastChecked: "2026-06-24",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    tokenRatioVsClaude: 1.0,
    verified: true,
    lastChecked: "2026-06-24",
  },
  // ── UNVERIFIED BELOW — replace with current published rates ───────────────
  {
    id: "gpt-frontier",
    label: "OpenAI (frontier tier)",
    provider: "openai",
    inputPerMTok: 5.0,
    outputPerMTok: 20.0,
    tokenRatioVsClaude: 0.85,
    verified: false,
    lastChecked: "never",
  },
  {
    id: "gpt-mini",
    label: "OpenAI (mini tier)",
    provider: "openai",
    inputPerMTok: 0.5,
    outputPerMTok: 2.0,
    tokenRatioVsClaude: 0.85,
    verified: false,
    lastChecked: "never",
  },
  {
    id: "gemini-pro",
    label: "Gemini (pro tier)",
    provider: "google",
    inputPerMTok: 2.5,
    outputPerMTok: 10.0,
    tokenRatioVsClaude: 0.9,
    verified: false,
    lastChecked: "never",
  },
  {
    id: "gemini-flash",
    label: "Gemini (flash tier)",
    provider: "google",
    inputPerMTok: 0.3,
    outputPerMTok: 1.2,
    tokenRatioVsClaude: 0.9,
    verified: false,
    lastChecked: "never",
  },
];

export interface UsageProjection {
  model: TargetModel;
  promptTokens: number;
  assumedOutputTokens: number;
  costPerRun: number;
  costPer1kRuns: number;
}

/**
 * Projects what one run of `claudePromptTokens` worth of prompt costs on each
 * target model, assuming a typical response length.
 */
export function projectAcrossProviders(
  claudePromptTokens: number,
  assumedOutputTokens: number,
  models: TargetModel[] = TARGET_MODELS,
): UsageProjection[] {
  return models.map((model) => {
    const promptTokens = Math.round(
      claudePromptTokens * model.tokenRatioVsClaude,
    );
    const outputTokens = Math.round(
      assumedOutputTokens * model.tokenRatioVsClaude,
    );
    const costPerRun =
      (promptTokens * model.inputPerMTok) / 1_000_000 +
      (outputTokens * model.outputPerMTok) / 1_000_000;
    return {
      model,
      promptTokens,
      assumedOutputTokens: outputTokens,
      costPerRun,
      costPer1kRuns: costPerRun * 1000,
    };
  });
}
