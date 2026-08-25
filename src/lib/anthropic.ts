import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared client.
 *
 * The zero-arg constructor resolves credentials from the environment in this
 * order: ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login`
 * profile on disk. Do not hardcode a key here, and do not import this module
 * from anything that runs in the browser.
 */

const globalForAnthropic = globalThis as unknown as {
  __pmAnthropic?: Anthropic;
};

export function getClient(): Anthropic {
  return (globalForAnthropic.__pmAnthropic ??= new Anthropic({
    // Two stages per request; a stuck first stage should not eat the whole
    // request budget. Milliseconds in the TypeScript SDK.
    timeout: 120_000,
    maxRetries: 2,
  }));
}

/** True when some credential source is configured. Checked before any call. */
export function hasCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

export class MissingCredentialsError extends Error {
  constructor() {
    super(
      "No Anthropic credentials found. Set ANTHROPIC_API_KEY in .env.local, " +
        "or run `ant auth login` to store a profile.",
    );
    this.name = "MissingCredentialsError";
  }
}

/** Maps SDK errors onto an HTTP status and a message safe to show a user. */
export function describeApiError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof MissingCredentialsError) {
    return { status: 500, message: error.message };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "Anthropic rejected the API key." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      message: "Rate limited by the Anthropic API. Try again shortly.",
    };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 400, message: `Invalid request: ${error.message}` };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: "Could not reach the Anthropic API." };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      status: error.status ?? 500,
      message: `Anthropic API error: ${error.message}`,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Unknown error.",
  };
}
