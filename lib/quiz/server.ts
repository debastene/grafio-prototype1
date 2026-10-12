/**
 * Akses kuis dari server (route handler) memakai sesi user.
 *
 * Jalur utama: fungsi SECURITY DEFINER di Supabase (list_week_quizzes,
 * get_quiz_public, submit_quiz — lihat supabase/patches/2026-10-12-*.sql).
 * Fungsi-fungsi itu tidak pernah mengirim correct_idx sebelum submit, dan
 * menilai + menyimpan + memberi kredit dalam satu transaksi.
 *
 * Fallback LEGACY hanya dipakai kalau fungsi belum ada (patch SQL belum
 * dijalankan, PostgREST error PGRST202) supaya deploy kode tidak mematahkan
 * kuis di jeda sebelum patch. Setelah patch, akses tabel langsung memang
 * ditolak oleh database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { creditsForScore, thisWeekStartWIB, type QuizCategory, type QuizQuestion } from "./types";

export type PublicQuizSummary = {
  id: string;
  title: string;
  category: QuizCategory;
  slot: number;
  question_count: number;
  attempt: { score: number; total: number; credits_awarded: number } | null;
};

export type PublicQuiz = {
  id: string;
  title: string;
  category: QuizCategory;
  expired: boolean;
  questions: { q: string; choices: string[] }[];
  attempt: { score: number; total: number; credits_awarded: number } | null;
};

export type SubmitResult =
  | {
      ok: true;
      quiz_id: string;
      title: string;
      score: number;
      total: number;
      pct: number;
      credits_awarded: number;
      corrections: {
        idx: number;
        chosen: number | null;
        correct_idx: number;
        is_correct: boolean;
        explanation: string;
        question: string;
        choices: string[];
      }[];
    }
  | { already_submitted: true; previous?: { score: number; total: number; credits_awarded: number } };

export class QuizError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

type PgError = { code?: string; message?: string } | null;

const isMissingFunction = (e: PgError) => e?.code === "PGRST202" || /could not find the function/i.test(e?.message ?? "");

function mapRpcError(e: PgError): QuizError {
  const m = e?.message ?? "";
  if (m.includes("quiz_not_found")) return new QuizError("Quiz tidak ditemukan.", 404, "quiz_not_found");
  if (m.includes("quiz_expired")) return new QuizError("Kuis ini sudah kadaluwarsa — kerjakan kuis minggu ini.", 410, "quiz_expired");
  if (m.includes("invalid_answers")) return new QuizError("Format jawaban tidak valid.", 400, "invalid_answers");
  if (m.includes("auth_required")) return new QuizError("Login dulu.", 401, "auth_required");
  console.error("[quiz] rpc error", e);
  return new QuizError("Gagal memproses kuis.", 500, "quiz_failed");
}

// ============================================================
// LIST
// ============================================================

export async function listWeekQuizzes(sb: SupabaseClient, userId: string): Promise<PublicQuizSummary[]> {
  const { data, error } = await sb.rpc("list_week_quizzes");
  if (!error) return (data ?? []) as PublicQuizSummary[];
  if (!isMissingFunction(error)) throw mapRpcError(error);

  // LEGACY (DB belum dipatch)
  const [{ data: quizzes, error: qErr }, { data: attempts }] = await Promise.all([
    sb
      .from("quizzes")
      .select("id, title, category, slot, questions")
      .eq("week_start", thisWeekStartWIB())
      .order("category")
      .order("slot"),
    sb.from("quiz_attempts").select("quiz_id, score, total, credits_awarded").eq("user_id", userId),
  ]);
  if (qErr) throw mapRpcError(qErr);
  const byQuiz = new Map((attempts ?? []).map((a) => [a.quiz_id as string, a]));
  return (quizzes ?? []).map((q) => {
    const a = byQuiz.get(q.id as string);
    return {
      id: q.id as string,
      title: q.title as string,
      category: q.category as QuizCategory,
      slot: q.slot as number,
      question_count: Array.isArray(q.questions) ? q.questions.length : 0,
      attempt: a ? { score: a.score, total: a.total, credits_awarded: a.credits_awarded } : null,
    };
  });
}

// ============================================================
// GET (tanpa kunci jawaban)
// ============================================================

export async function getPublicQuiz(sb: SupabaseClient, quizId: string, userId: string): Promise<PublicQuiz> {
  const { data, error } = await sb.rpc("get_quiz_public", { p_quiz_id: quizId });
  if (!error) {
    if (!data) throw new QuizError("Quiz tidak ditemukan atau sudah kadaluwarsa.", 404, "quiz_not_found");
    return data as PublicQuiz;
  }
  if (!isMissingFunction(error)) throw mapRpcError(error);

  // LEGACY — strip correct_idx & explanation DI SERVER sebelum dikirim.
  const [{ data: q, error: qErr }, { data: attempt }] = await Promise.all([
    sb.from("quizzes").select("id, title, category, week_start, questions").eq("id", quizId).maybeSingle(),
    sb
      .from("quiz_attempts")
      .select("score, total, credits_awarded")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .maybeSingle(),
  ]);
  if (qErr || !q) throw new QuizError("Quiz tidak ditemukan atau sudah kadaluwarsa.", 404, "quiz_not_found");
  return {
    id: q.id,
    title: q.title,
    category: q.category,
    expired: q.week_start !== thisWeekStartWIB(),
    questions: (q.questions as QuizQuestion[]).map((x) => ({ q: x.q, choices: x.choices })),
    attempt: attempt ?? null,
  };
}

// ============================================================
// SUBMIT
// ============================================================

export function validateAnswers(v: unknown): (number | null)[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) return null;
  for (const a of v) {
    if (a === null) continue;
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a > 3) return null;
  }
  return v as (number | null)[];
}

export async function submitQuiz(
  sb: SupabaseClient,
  quizId: string,
  answers: (number | null)[],
  userId: string,
): Promise<SubmitResult> {
  const { data, error } = await sb.rpc("submit_quiz", { p_quiz_id: quizId, p_answers: answers });
  if (!error) return data as SubmitResult;
  if (!isMissingFunction(error)) throw mapRpcError(error);

  // LEGACY (DB belum dipatch) — logika lama, tapi tetap server-side.
  const { data: existing } = await sb
    .from("quiz_attempts")
    .select("score, total, credits_awarded")
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .maybeSingle();
  if (existing) return { already_submitted: true, previous: existing };

  const { data: quiz, error: qErr } = await sb
    .from("quizzes")
    .select("id, title, week_start, questions")
    .eq("id", quizId)
    .single();
  if (qErr || !quiz) throw new QuizError("Quiz tidak ditemukan.", 404, "quiz_not_found");
  if (quiz.week_start !== thisWeekStartWIB()) {
    throw new QuizError("Kuis ini sudah kadaluwarsa — kerjakan kuis minggu ini.", 410, "quiz_expired");
  }
  const questions = quiz.questions as QuizQuestion[];
  if (answers.length !== questions.length) throw new QuizError("Format jawaban tidak valid.", 400, "invalid_answers");

  let score = 0;
  const corrections = questions.map((q, i) => {
    const chosen = answers[i];
    const correct = chosen === q.correct_idx;
    if (correct) score++;
    return {
      idx: i,
      chosen: chosen ?? null,
      correct_idx: q.correct_idx,
      is_correct: correct,
      explanation: q.explanation,
      question: q.q,
      choices: q.choices,
    };
  });
  const total = questions.length;
  const credits = creditsForScore(score, total);
  const { error: insErr } = await sb.from("quiz_attempts").insert({
    user_id: userId,
    quiz_id: quiz.id,
    answers,
    score,
    total,
    credits_awarded: credits,
  });
  if (insErr) {
    if (insErr.code === "23505") return { already_submitted: true };
    throw mapRpcError(insErr);
  }
  if (credits > 0) await sb.rpc("award_quiz_credits", { p_user_id: userId, p_credits: credits });
  return {
    ok: true,
    quiz_id: quiz.id,
    title: quiz.title,
    score,
    total,
    pct: Math.round((score / total) * 100),
    credits_awarded: credits,
    corrections,
  };
}
