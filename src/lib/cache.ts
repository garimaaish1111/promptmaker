import { createHash } from "node:crypto";
import type { OptimizeRequest, OptimizeResponse } from "./types";

/**
 * Response cache — the cheapest optimization in the app.
 *
 * A repeated request costs zero tokens and zero dollars. Prompt caching cuts
 * the input bill by ~90%; this cuts it by 100%, and in a classroom or demo
 * setting where the same example gets run repeatedly it does most of the work.
 *
 * Scope: in-process, per instance. On serverless this means it is per warm
 * container and dies on cold start. That is fine for a single-instance MVP and
 * wrong for production — swap `Store` for Redis or Vercel KV when you deploy
 * to more than one instance. The interface is deliberately small so that swap
 * is a single file change.
 */

/** Bump when prompts, schemas, or scoring change, to invalidate stale entries. */
const CACHE_VERSION = "v1";

const MAX_ENTRIES = 500;
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

interface Entry {
  value: OptimizeResponse;
  expiresAt: number;
}

/**
 * Key on everything that changes the output, and nothing that does not.
 *
 * `noCache` is excluded deliberately: a bypass request should still populate
 * the cache for the next caller.
 */
export function cacheKey(req: OptimizeRequest): string {
  const material = JSON.stringify({
    v: CACHE_VERSION,
    p: req.rawPrompt.trim(),
    c: req.category ?? null,
    t: req.target,
    m: req.mode,
    tone: req.tone ?? null,
    aud: req.audience ?? null,
    fmt: req.outputFormat ?? null,
    mw: req.maxWords ?? null,
  });
  return createHash("sha256").update(material).digest("hex");
}

class LruTtlCache {
  private store = new Map<string, Entry>();

  get(key: string): OptimizeResponse | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Re-insert to mark as most recently used; Map preserves insertion order.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: OptimizeResponse): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + TTL_MS });

    while (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Survives Next.js dev-mode module reloads, which would otherwise reset the
// cache on every edit and make hit-rate impossible to observe locally.
const globalForCache = globalThis as unknown as { __pmCache?: LruTtlCache };
export const responseCache = (globalForCache.__pmCache ??= new LruTtlCache());
