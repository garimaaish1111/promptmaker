import { z } from "zod";
import { CATEGORIES } from "./categories";
import { MODES, TARGET_FAMILIES } from "./types";

/**
 * Structured-output schemas.
 *
 * These are passed to `client.messages.parse()` via `zodOutputFormat`, which
 * constrains the model's response to valid JSON matching the schema. That is
 * itself a token saving: no "return only JSON, no markdown fences" boilerplate
 * in the prompt, and no retry loop when the model wraps its answer in prose.
 *
 * Keep them tight. Every optional field the model *could* fill is output
 * tokens it might spend, and output tokens cost 5x input.
 */

export const AnalysisSchema = z.object({
  intent: z.string(),
  category: z.enum(CATEGORIES),
  gaps: z.array(z.string()),
  ambiguities: z.array(z.string()),
  assumedContext: z.array(z.string()),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const scoreDimension = z.number().int().min(0).max(100);

export const SynthesisSchema = z.object({
  optimizedPrompt: z.string(),
  score: z.object({
    clarity: scoreDimension,
    specificity: scoreDimension,
    context: scoreDimension,
    constraints: scoreDimension,
    outputFormat: scoreDimension,
    efficiency: scoreDimension,
    overall: scoreDimension,
  }),
  assumptions: z.array(z.string()),
  placeholders: z.array(z.string()),
  suggestions: z.array(z.string()),
  efficiencyNotes: z.array(z.string()),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

/** Request validation for the /api/optimize route. */
export const OptimizeRequestSchema = z.object({
  rawPrompt: z.string().trim().min(3).max(20_000),
  category: z.enum(CATEGORIES).optional(),
  target: z.enum(TARGET_FAMILIES).default("claude"),
  mode: z.enum(MODES).default("balanced"),
  tone: z.string().max(120).optional(),
  audience: z.string().max(120).optional(),
  outputFormat: z.string().max(200).optional(),
  maxWords: z.number().int().positive().max(100_000).optional(),
  noCache: z.boolean().optional(),
});
