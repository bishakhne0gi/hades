// Author: Bishakh
// A simple in-memory token-bucket rate limiter, keyed per client. At the edge
// this rejects floods before they ever reach the origin.
interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds
}

/** capacity tokens, refilled at `refillPerSec` tokens/second. */
export function takeToken(key: string, capacity = 30, refillPerSec = 3, nowMs = Date.now()): RateLimitResult {
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: capacity, updated: nowMs };
    buckets.set(key, b);
  }
  // Refill based on elapsed time.
  const elapsed = (nowMs - b.updated) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
  b.updated = nowMs;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, remaining: Math.floor(b.tokens), retryAfter: 0 };
  }
  const retryAfter = Math.ceil((1 - b.tokens) / refillPerSec);
  return { allowed: false, remaining: 0, retryAfter };
}
