/**
 * Ograničenje neuspjelih prijava i drugih osjetljivih akcija.
 *
 * Ako su postavljeni UPSTASH_REDIS_REST_URL i UPSTASH_REDIS_REST_TOKEN,
 * koristi Upstash Redis (production-grade, radi u serverless i multi-instance
 * deploy-evima). Inače graceful fallback na in-memory (dev / single-instance).
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Bucket = { failures: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 25;

let redisClient: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let genericLimiters: Map<string, Ratelimit> = new Map();

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getLoginLimiter(): Ratelimit | null {
  if (loginLimiter) return loginLimiter;
  const r = getRedis();
  if (!r) return null;
  loginLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(MAX_FAILURES, `${WINDOW_MS / 1000} s`),
    analytics: false,
    prefix: "rl:login",
  });
  return loginLimiter;
}

function getBucket(key: string, now: number): Bucket {
  let b = memoryBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { failures: 0, resetAt: now + WINDOW_MS };
    memoryBuckets.set(key, b);
  }
  return b;
}

export type RateLimitResult = { blocked: false } | { blocked: true; retryAfterSec: number };

/**
 * Async varijanta (preferirana kada postoji Redis).
 * `isLoginBlocked` (sync) ostaje za kompatibilnost — ali koristi samo memory.
 */
export async function checkLoginRateLimit(key: string): Promise<RateLimitResult> {
  const limiter = getLoginLimiter();
  if (limiter) {
    const res = await limiter.limit(key);
    if (!res.success) {
      const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return { blocked: true, retryAfterSec };
    }
    return { blocked: false };
  }
  // fallback — memorija
  return isLoginBlocked(key);
}

/** Sinkrona provjera (memorija). Zadržano zbog postojećih sinkronih call-sitova. */
export function isLoginBlocked(key: string): RateLimitResult {
  const now = Date.now();
  const b = getBucket(key, now);
  if (b.failures >= MAX_FAILURES) {
    return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { blocked: false };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const b = getBucket(key, now);
  if (b.failures < MAX_FAILURES) b.failures += 1;
}

export function clearLoginFailures(key: string): void {
  memoryBuckets.delete(key);
}

/**
 * Generički rate limit po imenu (npr. "pinActivate", "forgotPassword", "signup").
 * Parametri se konfiguriraju jednom, nakon toga se isti limiter koristi.
 */
export async function checkRateLimit(
  scope: string,
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const r = getRedis();
  if (r) {
    let limiter = genericLimiters.get(scope);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSec} s`),
        analytics: false,
        prefix: `rl:${scope}`,
      });
      genericLimiters.set(scope, limiter);
    }
    const res = await limiter.limit(`${scope}:${key}`);
    if (!res.success) {
      return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
    }
    return { blocked: false };
  }

  // fallback na memoriju s istim parametrima
  const compositeKey = `${scope}:${key}`;
  const now = Date.now();
  const bucket = memoryBuckets.get(compositeKey);
  const windowMs = opts.windowSec * 1000;
  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(compositeKey, { failures: 1, resetAt: now + windowMs });
    return { blocked: false };
  }
  if (bucket.failures >= opts.limit) {
    return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.failures += 1;
  return { blocked: false };
}

export function clientKeyFromRequest(req: Request): string {
  // Cloudflare proxy: pravi client IP dolazi u CF-Connecting-IP
  // (X-Forwarded-For sadrži cijeli lanac proxyja).
  const cf = req.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const xf = req.headers.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}
