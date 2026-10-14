/**
 * Akses kuis dari server (route handler) memakai sesi user.
 *
 * Semua lewat fungsi SECURITY DEFINER di Supabase (list_week_quizzes,
 * get_quiz_public, submit_quiz — lihat supabase/patches/2026-10-12-*.sql).
 * Fungsi-fungsi itu mengenali user dari auth.uid() (bukan parameter), tidak
 * pernah mengirim correct_idx sebelum submit, dan menilai + menyimpan +
 * memberi kredit dalam satu transaksi. Tabel quizzes tidak bisa dibaca
 * langsung oleh anon/authenticated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizCategory } from "./types";

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

export async function listWeekQuizzes(sb: SupabaseClient): Promise<PublicQuizSummary[]> {
  const { data, error } = await sb.rpc("list_week_quizzes");
  if (error) throw mapRpcError(error);
  return (data ?? []) as PublicQuizSummary[];
}

// ============================================================
// GET (tanpa kunci jawaban)
// ============================================================

export async function getPublicQuiz(sb: SupabaseClient, quizId: string): Promise<PublicQuiz> {
  const { data, error } = await sb.rpc("get_quiz_public", { p_quiz_id: quizId });
  if (error) throw mapRpcError(error);
  if (!data) throw new QuizError("Quiz tidak ditemukan atau sudah kadaluwarsa.", 404, "quiz_not_found");
  return data as PublicQuiz;
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
): Promise<SubmitResult> {
  const { data, error } = await sb.rpc("submit_quiz", { p_quiz_id: quizId, p_answers: answers });
  if (error) throw mapRpcError(error);
  return data as SubmitResult;
}
