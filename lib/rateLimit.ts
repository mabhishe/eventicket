/**
 * In-memory sliding-window rate limiter.
 *
 * NOTE: buckets live in this Node process, so limits are per-instance. That is
 * fine for the current single-instance deploy (one `app` container). If the app
 * ever runs multiple instances behind a load balancer, swap this for a shared
 * store (e.g. Redis) keyed the same way.
 */

export type RateLimit = { limit: number; windowMs: number };

const buckets = new Map<string, number[]>();

// Longest window any caller uses (1 hour). Entries older than this can never
// count against a limit, so cleanup prunes anything older.
const MAX_WINDOW_MS = 60 * 60 * 1000;
const CLEANUP_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_MS) return;
  lastCleanup = now;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] < now - MAX_WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

/**
 * Client IP from proxy headers. Caddy sits in front of the app and sets
 * X-Forwarded-For; the first entry is the original client.
 */
export function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Check-and-record one hit against `key`. Returns ok:false with a Retry-After
 * value (seconds) when the limit is exceeded.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimit
): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const cutoff = now - windowMs;
  let hits = buckets.get(key);
  if (!hits) {
    hits = [];
    buckets.set(key, hits);
  }
  while (hits.length > 0 && hits[0] <= cutoff) hits.shift();
  if (hits.length >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((hits[0] + windowMs - now) / 1000)
    );
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  return { ok: true };
}

/** Test hook: reset all buckets (used by the smoke test only). */
export function resetRateLimits(): void {
  buckets.clear();
  lastCleanup = Date.now();
}
