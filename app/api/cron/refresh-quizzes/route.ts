/**
 * Cron job: regenerate 6 quizzes per minggu (3 datsci + 3 common, 10 soal each).
 *
 * Trigger: Vercel Cron tiap Senin 00:00 WIB = Minggu 17:00 UTC.
 * Lihat vercel.json untuk schedule.
 *
 * Idempotent: kalau quiz minggu ini sudah ada (week_start sama), skip (no overwrite).
 * Protected: butuh header `Authorization: Bearer ${CRON_SECRET}` supaya tidak bisa
 * di-trigger publik. Vercel Cron otomatis sertakan Authorization header.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callWithFallback, CHAINS, safeParseJSON } from "@/lib/openrouter";
import { thisWeekStartWIB, type QuizCategory, type QuizQuestion } from "@/lib/quiz/types";

// Untuk Vercel Hobby (60s function timeout) — pakai chain pendek (cuma 2 model
// pertama) supaya total wall-clock-time ≤ 30s per quiz, lebih cepat dari
// CHAINS.structured penuh yang punya 6 model.
const CRON_CHAIN = CHAINS.structured.slice(0, 2);

export const runtime = "nodejs";
// Vercel Hobby plan cap di 60s. Pakai 60 supaya tidak ditolak deploy.
// Kalau upgrade ke Pro, bisa naikkan ke 300.
export const maxDuration = 60;

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const SYS_DATSCI = `Kamu Grafio AI — kurator soal kuis data science dalam Bahasa Indonesia.
Buat 8 soal multiple choice tingkat menengah tentang data science, statistika dasar,
machine learning fundamental, atau visualisasi data.

Aturan WAJIB:
- 8 soal, masing-masing 4 jawaban (A/B/C/D — di output sebagai array).
- correct_idx: index 0-3 dari jawaban benar.
- explanation: 2-4 kalimat menjelaskan kenapa jawaban itu benar — gunakan analogi/contoh
  konkret biar user awam paham. Hindari jargon berat.
- Variasi topik: 2 statistika dasar, 2 ML/AI, 2 visualisasi, 2 data cleaning/eksplorasi.
- Tingkat: orang yang tahu sedikit programming tapi belum jago datsci.
- TIDAK ADA pertanyaan tentang nama tools spesifik (Python library version dll).

Output JSON murni:
{
  "title": "<judul singkat 4-6 kata>",
  "questions": [
    { "q": "...", "choices": ["A", "B", "C", "D"], "correct_idx": 0, "explanation": "..." }
  ]
}`;

const SYS_COMMON = `Kamu Grafio AI — kurator soal kuis pengetahuan umum dalam Bahasa Indonesia.
Buat 8 soal multiple choice tingkat menengah tentang pengetahuan umum: sains, sejarah dunia,
geografi, sastra, budaya populer, ekonomi global, atau penemuan teknologi.

Aturan WAJIB:
- 8 soal, masing-masing 4 jawaban.
- correct_idx: index 0-3 dari jawaban benar.
- explanation: 2-4 kalimat — fact-based, ringan, sedikit fun-fact bila perlu.
- Variasi topik: tidak semua dari 1 bidang. Hindari pertanyaan sangat lokal-spesifik
  (selain Indonesia umum). Hindari pertanyaan yang outdated > 5 tahun.
- Tingkat: orang umum yang baca berita & punya wawasan rata-rata.

Output JSON murni:
{
  "title": "<judul singkat 4-6 kata>",
  "questions": [
    { "q": "...", "choices": ["A", "B", "C", "D"], "correct_idx": 0, "explanation": "..." }
  ]
}`;

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron menyisipkan Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET env var belum di-set" },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runRefresh();
}

// Manual trigger via POST (untuk testing dari admin)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runRefresh();
}

async function runRefresh() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service env vars belum di-set" },
      { status: 500 },
    );
  }

  // Pakai service role key supaya bypass RLS (cron job runs as system)
  const sb = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const weekStart = thisWeekStartWIB();

  // Cek apakah quiz minggu ini sudah ada (idempotent)
  const { data: existing, error: chkErr } = await sb
    .from("quizzes")
    .select("category, slot")
    .eq("week_start", weekStart);
  if (chkErr) {
    return NextResponse.json({ error: chkErr.message }, { status: 500 });
  }
  if (existing && existing.length >= 6) {
    return NextResponse.json({
      ok: true,
      message: `Quiz minggu ${weekStart} sudah lengkap (${existing.length} quiz). Skip.`,
      week_start: weekStart,
    });
  }

  // Generate quiz yang belum ada
  const present = new Set(
    (existing as { category: string; slot: number }[] | null)?.map(
      (r) => `${r.category}:${r.slot}`,
    ) ?? [],
  );
  const tasks: { category: QuizCategory; slot: number }[] = [];
  for (const cat of ["datsci", "common"] as QuizCategory[]) {
    for (let slot = 1; slot <= 3; slot++) {
      if (!present.has(`${cat}:${slot}`)) tasks.push({ category: cat, slot });
    }
  }

  // PARALLEL — Vercel Hobby plan 60s timeout terlalu pendek untuk 6 AI call
  // sekuensial. Free tier OpenRouter ~20 req/min jadi 6 paralel aman.
  // Promise.allSettled supaya kalau 1 gagal, yang lain tetap di-process.
  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      const generated = await generateQuiz(task.category);
      const { error: insErr } = await sb.from("quizzes").insert({
        week_start: weekStart,
        category: task.category,
        slot: task.slot,
        title: generated.title,
        questions: generated.questions,
        generated_by: generated.model,
      });
      if (insErr) throw new Error(insErr.message);
      return task;
    }),
  );

  const results = settled.map((r, i) => {
    const task = tasks[i];
    if (r.status === "fulfilled") return { ok: true, ...task };
    return {
      ok: false,
      ...task,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  return NextResponse.json({
    ok: true,
    week_start: weekStart,
    inserted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

async function generateQuiz(
  category: QuizCategory,
): Promise<{ title: string; questions: QuizQuestion[]; model: string }> {
  const sys = category === "datsci" ? SYS_DATSCI : SYS_COMMON;

  const { text, model } = await callWithFallback(CRON_CHAIN, {
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: `Generate 8 soal sekarang. Variasi topik & tingkat kesulitan. JSON murni.`,
      },
    ],
    temperature: 0.75,
    // 8 soal × ~250 token = 2000 token. Lebih ramping dari sebelumnya (3500)
    // supaya total time per call ≤ 25s.
    maxTokens: 2500,
    // Per-attempt timeout pendek — total budget Vercel Hobby 60s, harus muat
    // 2 attempt fallback + overhead. 22s × 2 + buffer = 50s.
    timeoutMs: 22_000,
    responseFormat: "json_object",
  });

  const parsed = safeParseJSON<{ title?: string; questions?: QuizQuestion[] }>(text);
  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 5) {
    throw new Error(`Quiz invalid: hanya ${parsed.questions?.length ?? 0} soal valid`);
  }

  // Validate per-question shape, fix common drift. Slice 8 sesuai target,
  // tapi AI kadang kasih lebih atau kurang.
  const cleaned: QuizQuestion[] = parsed.questions.slice(0, 8).map((q) => ({
    q: String(q.q ?? "").trim(),
    choices: Array.isArray(q.choices) ? q.choices.slice(0, 4).map((c) => String(c)) : [],
    correct_idx:
      typeof q.correct_idx === "number" && q.correct_idx >= 0 && q.correct_idx < 4
        ? q.correct_idx
        : 0,
    explanation: String(q.explanation ?? "").trim(),
  }));

  // Pastikan tiap soal punya 4 choices
  for (const q of cleaned) {
    while (q.choices.length < 4) q.choices.push("(opsi tambahan)");
  }

  return {
    title: parsed.title?.trim() || (category === "datsci" ? "Kuis Data Science" : "Kuis Pengetahuan Umum"),
    questions: cleaned,
    model,
  };
}
