import { NextResponse } from "next/server";
import { CATEGORY_META } from "@/lib/categories";
import { guessCategory, roughTokenEstimate, structuralScore } from "@/lib/heuristics";
import { projectAcrossProviders } from "@/lib/providers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Free pre-flight check.
 *
 * Runs entirely locally: no API call, no credentials, no tokens, no latency.
 * The point is to let a user see how weak their draft is, and roughly what it
 * will cost to run, *before* deciding to spend anything optimizing it.
 *
 * Every number here is an estimate. The optimize route returns measured
 * figures from the API's own usage accounting.
 */

const EstimateSchema = z.object({
  rawPrompt: z.string().max(20_000),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = EstimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { rawPrompt } = parsed.data;
  const structural = structuralScore(rawPrompt);
  const category = guessCategory(rawPrompt);
  const promptTokens = roughTokenEstimate(rawPrompt);
  const assumedOutputTokens = category
    ? CATEGORY_META[category].typicalOutputTokens
    : 900;

  return NextResponse.json({
    approximate: true,
    structural,
    category,
    promptTokens,
    assumedOutputTokens,
    projections: projectAcrossProviders(promptTokens, assumedOutputTokens),
  });
}
