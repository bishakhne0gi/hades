// Author: Bishakh
// Tiny in-memory edge cache for cacheable GETs, with stale-while-revalidate-ish
// TTL. Real CDNs do this at scale; here it shows the concept + the HIT/MISS header.
interface Entry {
  body: string;
  contentType: string;
  expires: number;
}

const store = new Map<string, Entry>();

export function getCached(key: string, nowMs = Date.now()): Entry | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expires < nowMs) {
    store.delete(key);
    return null;
  }
  return e;
}

export function setCached(key: string, body: string, contentType: string, ttlMs: number, nowMs = Date.now()): void {
  store.set(key, { body, contentType, expires: nowMs + ttlMs });
}

/** Which paths are safe to cache at the edge (slow-changing, non-streaming). */
export function isCacheable(path: string): boolean {
  return path === "/bff/standings" || path === "/bff/news";
}
