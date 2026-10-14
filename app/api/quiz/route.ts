/**
 * Daftar kuis minggu ini + attempt user + saldo credits.
 * Client tidak lagi membaca tabel quizzes langsung (kolom questions berisi
 * kunci jawaban) — lihat lib/quiz/server.ts.
 */

import { NextResponse } from "next/server";
import { listWeekQuizzes } from "@/lib/quiz/server";
import { quizErrorResponse, requireQuizUser } from "@/lib/quiz/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireQuizUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const [quizzes, { data: profile }] = await Promise.all([
      listWeekQuizzes(auth.sb),
      auth.sb.from("profiles").select("credits").eq("id", auth.userId).maybeSingle(),
    ]);
    return NextResponse.json({ quizzes, credits: (profile as { credits?: number } | null)?.credits ?? 0 });
  } catch (e) {
    return quizErrorResponse(e);
  }
}
