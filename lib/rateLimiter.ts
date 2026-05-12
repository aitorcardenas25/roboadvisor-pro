// Sliding window rate limiter — in-memory, per identifier (IP or user ID).
// For multi-instance deployments replace the Map store with a Redis adapter.

interface Entry { count: number; resetAt: number }

const store = new Map<string, Entry>();

// Prune stale entries every 5 min to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60_000).unref?.();

export interface RateLimitResult {
  ok:         boolean;
  remaining:  number;
  resetInMs:  number;
}

export function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs:    number,
): RateLimitResult {
  const now   = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    ok:        entry.count <= maxRequests,
    remaining,
    resetInMs: entry.resetAt - now,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(Math.ceil(result.resetInMs / 1000)),
    ...(result.ok ? {} : { 'Retry-After': String(Math.ceil(result.resetInMs / 1000)) }),
  };
}

export function rateLimitResponse(resetInMs: number): Response {
  return new Response(
    JSON.stringify({ error: 'Massa peticions. Torna-ho a intentar més tard.' }),
    {
      status:  429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After':  String(Math.ceil(resetInMs / 1000)),
      },
    },
  );
}

// Predefined limits
export const LIMITS = {
  publicApi:   { maxRequests: 20,  windowMs: 60_000 },  // 20 req/min
  authEndpoint:{ maxRequests: 10,  windowMs: 60_000 },  // 10 req/min (brute-force)
  reportGen:   { maxRequests:  5,  windowMs: 60_000 },  // 5 req/min (expensive)
  adminApi:    { maxRequests: 60,  windowMs: 60_000 },  // 60 req/min
} as const;
