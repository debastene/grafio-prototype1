/**
 * Submit jawaban kuis. Penilaian, penyimpanan attempt, dan pemberian credits
 * terjadi di database dalam SATU transaksi (fungsi submit_quiz) memakai
 * auth.uid() — client tidak bisa memalsukan skor atau memanggil RPC kredit.
 *
 * Flow:
 *   1. User submit { quiz_id, answers: (0-3 | null)[] }
 *   2. submit_quiz() menilai, insert attempt (UNIQUE user × quiz), award credits
 *   3. Return skor + correct_idx + explanations (baru dibuka setelah submit)
 */

import { NextRequest, NextResponse } from "next/server";
import { submitQuiz, validateAnswers } from "@/lib/quiz/server";
import { quizErrorResponse, requireQuizUser } from "@/lib/quiz/session";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await requireQuizUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as { quiz_id?: unknown; answers?: unknown } | null;
  const answers = validateAnswers(body?.answers);
  if (typeof body?.quiz_id !== "string" || !UUID_RE.test(body.quiz_id) || !answers) {
    return NextResponse.json(
      { error: "quiz_id (uuid) dan answers (array 0-3/null) wajib" },
      { status: 400 },
    );
  }

  try {
    const result = await submitQuiz(auth.sb, body.quiz_id, answers, auth.userId);
    if ("already_submitted" in result) {
      return NextResponse.json(
        {
          error: "Kamu sudah mengerjakan kuis ini minggu ini. Tunggu refresh berikutnya.",
          already_submitted: true,
          previous: result.previous ?? null,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    return quizErrorResponse(e);
  }
}
