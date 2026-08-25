import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, hasCredentials, MissingCredentialsError } from "./anthropic";
import { cacheKey, responseCache } from "./cache";
import { CATEGORY_META, type Category } from "./categories";
import { priceUsage, sumCosts } from "./cost";
import { canSkipAnalysis } from "./heuristics";
import type { ClaudeModelId } from "./models";
import {
  ANALYSIS_SYSTEM,
  buildSynthesisSystem,
  buildSynthesisUserMessage,
} from "./prompts";
import { projectAcrossProviders } from "./providers";
import { AnalysisSchema, SynthesisSchema, type Analysis } from "./schemas";
import { countMany } from "./tokens";
import type {
  Mode,
  OptimizeRequest,
  OptimizeResponse,
  StageLedger,
} from "./types";

/**
 * The two-stage optimization pipeline.
 *
 * Stage 1 (analysis) classifies the draft and finds its gaps. It is a cheap
 * job, so it runs on Haiku, and it is skipped entirely when local heuristics
 * can answer both questions on their own.
 *
 * Stage 2 (synthesis) writes the prompt. This is where quality is decided, so
 * it runs on the good model — but with a heavily cached system prefix, so the
 * expensive model reads most of its input at 0.1x.
 *
 * The order matters for cost: stage 1's output shrinks stage 2's job from
 * "figure out what this is and fix it" to "fix this known set of gaps", which
 * is both cheaper and more reliable.
 */

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

interface StagePlan {
  model: ClaudeModelId;
  effort: Effort | null;
  adaptiveThinking: boolean;
  maxTokens: number;
}

interface ModePlan {
  analysis: StagePlan;
  synthesis: StagePlan;
}

/**
 * Model assignment per mode.
 *
 * Haiku 4.5 predates `output_config.effort` and adaptive thinking; sending
 * either returns a 400, hence the nulls. Opus 5 and Sonnet 5 accept both.
 */
const PLANS: Record<Mode, ModePlan> = {
  economy: {
    analysis: {
      model: "claude-haiku-4-5",
      effort: null,
      adaptiveThinking: false,
      maxTokens: 2000,
    },
    synthesis: {
      model: "claude-sonnet-5",
      effort: "low",
      adaptiveThinking: true,
      maxTokens: 8000,
    },
  },
  balanced: {
    analysis: {
      model: "claude-haiku-4-5",
      effort: null,
      adaptiveThinking: false,
      maxTokens: 2000,
    },
    synthesis: {
      model: "claude-opus-5",
      effort: "medium",
      adaptiveThinking: true,
      maxTokens: 16000,
    },
  },
  max: {
    analysis: {
      model: "claude-opus-5",
      effort: "low",
      adaptiveThinking: true,
      maxTokens: 8000,
    },
    synthesis: {
      model: "claude-opus-5",
      effort: "xhigh",
      adaptiveThinking: true,
      maxTokens: 20000,
    },
  },
};

/** Builds the model-specific half of a request, honouring per-model support. */
function stageParams(plan: StagePlan) {
  return {
    model: plan.model,
    max_tokens: plan.maxTokens,
    ...(plan.adaptiveThinking
      ? { thinking: { type: "adaptive" as const } }
      : {}),
  };
}

function effortConfig(plan: StagePlan) {
  return plan.effort ? { effort: plan.effort } : {};
}

async function runAnalysis(
  plan: StagePlan,
  rawPrompt: string,
  forcedCategory: Category | undefined,
): Promise<{ analysis: Analysis; ledger: StageLedger }> {
  const categoryHint = forcedCategory
    ? `\n\nThe user has already chosen the category "${forcedCategory}". Use it.`
    : "";

  const response = await getClient().messages.parse({
    ...stageParams(plan),
    system: ANALYSIS_SYSTEM + categoryHint,
    messages: [
      {
        role: "user",
        // Delimited so the draft reads as data. The analysis system prompt
        // never treats its contents as instructions.
        content: `<draft_prompt>\n${rawPrompt.trim()}\n</draft_prompt>`,
      },
    ],
    output_config: {
      ...effortConfig(plan),
      format: zodOutputFormat(AnalysisSchema),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Analysis stage returned no parseable output.");
  }

  return {
    analysis: forcedCategory ? { ...parsed, category: forcedCategory } : parsed,
    ledger: { stage: "analysis", cost: priceUsage(plan.model, response.usage) },
  };
}

export async function optimize(
  req: OptimizeRequest,
): Promise<OptimizeResponse> {
  const startedAt = Date.now();

  if (!req.noCache) {
    const hit = responseCache.get(cacheKey(req));
    if (hit) {
      // Report a fresh elapsed time and zeroed spend — a cache hit costs
      // nothing, and reusing the original numbers would double-count.
      return {
        ...hit,
        cacheHit: true,
        ledger: [],
        generationCost: {
          totalCost: 0,
          uncachedEquivalentCost: hit.generationCost.uncachedEquivalentCost,
          cacheSavings: hit.generationCost.uncachedEquivalentCost,
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
        elapsedMs: Date.now() - startedAt,
      };
    }
  }

  if (!hasCredentials()) throw new MissingCredentialsError();

  const plan = PLANS[req.mode];
  const ledger: StageLedger[] = [];

  // ─── Stage 1 ──────────────────────────────────────────────────────────────
  // Skipped when local heuristics already know the category and the draft is
  // structurally complete. That removes one API call outright.
  const precheck = canSkipAnalysis(req.rawPrompt, req.category);
  let analysis: Analysis;
  let skippedAnalysis = false;

  if (precheck.skip && precheck.category) {
    skippedAnalysis = true;
    analysis = {
      intent: req.rawPrompt.trim().slice(0, 300),
      category: precheck.category,
      // The heuristic knows which structural slots are empty by name, which is
      // enough to steer synthesis without paying for a model to say the same.
      gaps: precheck.structural.missing.map((m) => `unspecified: ${m}`),
      ambiguities: [],
      assumedContext: [],
    };
  } else {
    const analysed = await runAnalysis(plan.analysis, req.rawPrompt, req.category);
    analysis = analysed.analysis;
    ledger.push(analysed.ledger);
  }

  // ─── Stage 2 ──────────────────────────────────────────────────────────────
  const synthPlan = plan.synthesis;
  const synthesisResponse = await getClient().messages.parse({
    ...stageParams(synthPlan),
    system: buildSynthesisSystem(analysis.category, req.target),
    messages: [
      {
        role: "user",
        content: buildSynthesisUserMessage({
          rawPrompt: req.rawPrompt,
          intent: analysis.intent,
          gaps: analysis.gaps,
          ambiguities: analysis.ambiguities,
          tone: req.tone,
          audience: req.audience,
          outputFormat: req.outputFormat,
          maxWords: req.maxWords,
        }),
      },
    ],
    output_config: {
      ...effortConfig(synthPlan),
      format: zodOutputFormat(SynthesisSchema),
    },
  });

  const synthesis = synthesisResponse.parsed_output;
  if (!synthesis) {
    throw new Error("Synthesis stage returned no parseable output.");
  }

  ledger.push({
    stage: "synthesis",
    cost: priceUsage(synthPlan.model, synthesisResponse.usage),
  });

  // ─── Economics of the generated prompt ────────────────────────────────────
  const [originalPromptTokens, promptTokens] = await countMany([
    req.rawPrompt,
    synthesis.optimizedPrompt,
  ]);
  const assumedOutputTokens = CATEGORY_META[analysis.category].typicalOutputTokens;

  const response: OptimizeResponse = {
    result: {
      optimizedPrompt: synthesis.optimizedPrompt,
      category: analysis.category,
      intent: analysis.intent,
      score: synthesis.score,
      gaps: analysis.gaps,
      assumptions: synthesis.assumptions,
      placeholders: synthesis.placeholders,
      suggestions: synthesis.suggestions,
      efficiencyNotes: synthesis.efficiencyNotes,
    },
    ledger,
    generationCost: sumCosts(ledger.map((l) => l.cost)),
    economics: {
      promptTokens,
      originalPromptTokens,
      tokenDelta: promptTokens - originalPromptTokens,
      assumedOutputTokens,
      projections: projectAcrossProviders(promptTokens, assumedOutputTokens),
      approximate: false,
    },
    cacheHit: false,
    skippedAnalysis,
    elapsedMs: Date.now() - startedAt,
  };

  responseCache.set(cacheKey(req), response);
  return response;
}
