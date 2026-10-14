/**
 * Guard untuk route AI (/api/analyze, /api/chat, /api/explain).
 *
 * Urutan pemeriksaan di tiap route:
 *   1. authorizeAi()   — kalau Supabase dikonfigurasi (production posture),
 *      route AI wajib login. Tanpa Supabase (local prototype), key = IP.
 *   2. readJsonBody()  — tolak body > batas ukuran SEBELUM di-parse.
 *   3. validasi/sanitasi payload (lib/server/aiSanitize.ts) → 400 kalau rusak.
 *   4. consumeAiQuota() — kuota baru dipotong untuk request yang valid,
 *      jadi body salah format tidak menghabiskan jatah user.
 *
 * Penyimpanan counter: lihat lib/server/rateLimit.ts — Upstash Redis (global,
 * kalau env UPSTASH_REDIS_REST_URL/TOKEN diisi) dengan fallback in-memory
 * per instance.
 *
 * Limit free-tier disamakan dengan janji di halaman pricing
 * ("3-5 prompt analisis per 6 jam") — lihat AI_LIMITS.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase, SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import { take } from "./rateLimit";

// ============================================================
// LIMITS PER BUCKET (free tier)
// ============================================================

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export const AI_LIMITS = {
  /** Analisis penuh — paling mahal (prompt besar + structured output). */
  analyze: { limit: 5, windowMs: SIX_HOURS_MS },
  /**
   * Enrichment (clarify/narrate/chart/followup/rename/chart-insights).
   * Satu analisis memicu ±4-6 call explain, jadi kuotanya ~8× analyze.
   */
  explain: { limit: 40, windowMs: SIX_HOURS_MS },
  /** Chat copilot — ringan tapi sering. */
  chat: { limit: 60, windowMs: SIX_HOURS_MS },
} as const;

export type AiBucket = keyof typeof AI_LIMITS;

/** Batas ukuran body per route (byte). Payload sah jauh di bawah ini. */
export const MAX_BODY_BYTES = {
  analyze: 24 * 1024,
  chat: 64 * 1024,
  explain: 96 * 1024,
} as const;

// ============================================================
// GUARD
// ============================================================

function clientIp(req: NextRequest): string {
  // Vercel/proxy set x-forwarded-for; ambil hop pertama.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown-ip";
}

function humanWindow(windowMs: number): string {
  const h = windowMs / (60 * 60 * 1000);
  return h >= 1 ? `${h} jam` : `${Math.round(windowMs / 60000)} menit`;
}

/** Identitas pemanggil untuk rate limit. */
export type AiCaller = { key: string };

/**
 * Langkah 1 — autentikasi. Return AiCaller kalau boleh lanjut, atau
 * NextResponse 401 kalau harus ditolak.
 */
export async function authorizeAi(req: NextRequest): Promise<AiCaller | NextResponse> {
  if (SUPABASE_CONFIGURED) {
    const sb = getServerSupabase(await cookies()); // Next 15: cookies() async
    const { data } = sb
      ? await sb.auth.getUser()
      : { data: { user: null } };

    if (!data.user) {
      return NextResponse.json(
        {
          error:
            "Login dulu untuk pakai fitur AI Grafio. Daftar gratis di /signup — engine statistik tetap bisa dipakai tanpa login.",
          code: "auth_required",
        },
        { status: 401 },
      );
    }
    return { key: `user:${data.user.id}` };
  }
  // Local prototype tanpa Supabase — tetap rate-limit per IP.
  return { key: `ip:${clientIp(req)}` };
}

/**
 * Langkah 2 — baca body JSON dengan batas ukuran. Content-Length dicek dulu
 * supaya body raksasa ditolak tanpa dibaca utuh.
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number,
): Promise<{ ok: true; data: unknown } | { ok: false; res: NextResponse }> {
  const tooLarge = () => ({
    ok: false as const,
    res: NextResponse.json(
      { error: `Payload terlalu besar (maks ${Math.round(maxBytes / 1024)} KB).`, code: "payload_too_large" },
      { status: 413 },
    ),
  });
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return tooLarge();

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Body tidak terbaca" }, { status: 400 }) };
  }
  if (new TextEncoder().encode(text).length > maxBytes) return tooLarge();
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

/**
 * Langkah 4 — potong kuota bucket. null kalau masih ada jatah, 429 kalau habis.
 */
export async function consumeAiQuota(caller: AiCaller, bucket: AiBucket): Promise<NextResponse | null> {
  const { limit, windowMs } = AI_LIMITS[bucket];
  const res = await take(`${bucket}:${caller.key}`, limit, windowMs);
  if (res.ok) return null;
  return NextResponse.json(
    {
      error: `Kuota AI tercapai (${limit} request per ${humanWindow(windowMs)}). Coba lagi dalam ±${Math.ceil(res.retryAfterSec / 60)} menit.`,
      code: "rate_limited",
      retryAfterSec: res.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(res.retryAfterSec) },
    },
  );
}

/**
 * Error dari upstream (OpenRouter / provider) TIDAK diteruskan mentah ke
 * client — bisa berisi nama provider, kuota akun, atau potongan prompt.
 * Detail cukup di log server.
 */
export function aiErrorResponse(route: string, err: unknown): NextResponse {
  const status = (err as { status?: number })?.status;
  console.error(`[${route}] AI error`, status ?? "", err instanceof Error ? err.message : err);
  const busy = status === 429 || status === 502 || status === 503 || status === 504;
  return NextResponse.json(
    {
      error: busy
        ? "Layanan AI sedang sibuk. Hasil engine statistik tetap tersedia — coba lagi sebentar lagi."
        : "AI gagal memproses permintaan ini. Hasil engine statistik tetap tersedia.",
      code: busy ? "ai_busy" : "ai_failed",
    },
    { status: busy ? 503 : 502 },
  );
}
