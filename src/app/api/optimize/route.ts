import { NextResponse } from "next/server";
import { describeApiError } from "@/lib/anthropic";
import { optimize } from "@/lib/pipeline";
import { OptimizeRequestSchema } from "@/lib/schemas";

// The pipeline uses node:crypto and the Anthropic SDK — Node runtime, not edge.
export const runtime = "nodejs";
// Never cache at the framework layer; the app manages its own response cache
// and needs the hit/miss signal to stay accurate.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = OptimizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await optimize(parsed.data));
  } catch (error) {
    const { status, message } = describeApiError(error);
    console.error("[optimize]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
