/**
 * Satu kuis untuk dikerjakan — HANYA teks soal & pilihan. correct_idx dan
 * explanation baru dikirim setelah submit (POST /api/quiz/submit).
 */

import { NextResponse } from "next/server";
import { getPublicQuiz } from "@/lib/quiz/server";
import { quizErrorResponse, requireQuizUser } from "@/lib/quiz/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Next 15: params berbentuk Promise di route handler.
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Quiz tidak ditemukan.", code: "quiz_not_found" }, { status: 404 });
  }
  const auth = await requireQuizUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getPublicQuiz(auth.sb, id));
  } catch (e) {
    return quizErrorResponse(e);
  }
}
