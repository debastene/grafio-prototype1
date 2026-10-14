/**
 * Rate limiter sliding-window dengan dua backend:
 *
 *   1. Upstash Redis (REST) — dipakai otomatis kalau env
 *      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN terisi. Counter
 *      GLOBAL untuk semua instance serverless Vercel.
 *   2. In-memory — fallback (dev lokal, env kosong, atau Upstash error).
 *      Counter per instance: cukup menahan abuse kasual, tidak global.
 *
 * Upstash dipanggil lewat fetch REST + skrip Lua (atomik) — tanpa dependensi
 * tambahan.
 */

export type TakeResult =
  | { ok: true; remaining: number; backend: "upstash" | "memory" }
  | { ok: false; retryAfterSec: number; backend: "upstash" | "memory" };

// ============================================================
// IN-MEMORY
// ============================================================

/** key → timestamps (ms) request yang masih di dalam window. */
const hits = new Map<string, number[]>();

/** Cegah Map tumbuh tak terbatas di instance yang hidup lama. */
const MAX_KEYS = 5_000;

export function takeMemory(key: string, limit: number, windowMs: number, now = Date.now()): TakeResult {
  const windowStart = now - windowMs;

  let stamps = hits.get(key);
  if (!stamps) {
    // Evict paling kasar tapi cukup: kalau penuh, buang semua entry basi dulu.
    if (hits.size >= MAX_KEYS) {
      const keysToDelete: string[] = [];
      hits.forEach((v, k) => {
        if (v.length === 0 || v[v.length - 1] < windowStart) keysToDelete.push(k);
      });
      for (const k of keysToDelete) hits.delete(k);
      if (hits.size >= MAX_KEYS) hits.clear(); // fail-open, jangan sampai OOM
    }
    stamps = [];
    hits.set(key, stamps);
  }

  // Drop timestamp di luar window (array selalu terurut naik).
  let firstValid = 0;
  while (firstValid < stamps.length && stamps[firstValid] <= windowStart) firstValid++;
  if (firstValid > 0) stamps.splice(0, firstValid);

  if (stamps.length >= limit) {
    const retryAfterMs = stamps[0] + windowMs - now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)), backend: "memory" };
  }

  stamps.push(now);
  return { ok: true, remaining: limit - stamps.length, backend: "memory" };
}

/** Untuk test. */
export function resetMemoryLimiter(): void {
  hits.clear();
}

// ============================================================
// UPSTASH (REST + Lua, atomik)
// ============================================================

/**
 * Sorted set per key: score = timestamp ms. Hapus entri di luar window,
 * hitung sisa, tolak kalau penuh (kembalikan timestamp tertua untuk
 * Retry-After), selain itu tambah entri baru + perpanjang TTL.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2])}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1}
`;

export function upstashConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

export async function takeUpstash(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<TakeResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/+$/, "");
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      SLIDING_WINDOW_LUA,
      "1",
      `grafio:rl:${key}`,
      String(now),
      String(windowMs),
      String(limit),
      member,
    ]),
    // Jangan biarkan Redis lambat menahan request AI.
    signal: AbortSignal.timeout(1_500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const json = (await res.json()) as { result?: [number, number]; error?: string };
  if (json.error || !Array.isArray(json.result)) throw new Error(`Upstash: ${json.error ?? "respons tidak dikenal"}`);
  const [allowed, value] = json.result;
  if (allowed === 1) return { ok: true, remaining: value, backend: "upstash" };
  const retryAfterMs = value + windowMs - now;
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)), backend: "upstash" };
}

// ============================================================
// PUBLIC
// ============================================================

/**
 * Ambil satu token dari bucket `key`. Upstash kalau dikonfigurasi; kalau
 * Upstash error/timeout, jatuh ke in-memory (tetap ada batas, tidak fail-open).
 */
export async function take(key: string, limit: number, windowMs: number): Promise<TakeResult> {
  if (upstashConfigured()) {
    try {
      return await takeUpstash(key, limit, windowMs);
    } catch (e) {
      console.error("[rateLimit] Upstash gagal, fallback in-memory:", e instanceof Error ? e.message : e);
    }
  }
  return takeMemory(key, limit, windowMs);
}
