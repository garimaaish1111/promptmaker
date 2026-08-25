import { getClient } from "./anthropic";
import { roughTokenEstimate } from "./heuristics";
import type { ClaudeModelId } from "./models";

/**
 * Token counting.
 *
 * `count_tokens` is the only accurate source for Claude token counts, and it
 * is not billed — but it is still a network round trip, so call it once per
 * value and run independent counts concurrently.
 *
 * Counts are model-specific. Pass the model the text will actually be sent to.
 *
 * Never substitute tiktoken or gpt-tokenizer here. They are OpenAI tokenizers
 * and undercount Claude by roughly 15-20% on prose, and by considerably more
 * on code.
 */

export async function countClaudeTokens(
  text: string,
  model: ClaudeModelId = "claude-opus-5",
): Promise<number> {
  if (!text.trim()) return 0;

  try {
    const response = await getClient().messages.countTokens({
      model,
      messages: [{ role: "user", content: text }],
    });
    return response.input_tokens;
  } catch {
    // A failed count must not fail the whole request — the optimized prompt is
    // the product, the token figure is a nice-to-have. Fall back to the local
    // estimate; callers mark the result as approximate.
    return roughTokenEstimate(text);
  }
}

/** Counts several strings in one round trip's worth of wall time. */
export async function countMany(
  texts: string[],
  model: ClaudeModelId = "claude-opus-5",
): Promise<number[]> {
  return Promise.all(texts.map((t) => countClaudeTokens(t, model)));
}
