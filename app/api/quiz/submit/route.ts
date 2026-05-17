/**
 * Submit jawaban kuis. Server-side scoring biar correct_idx tidak leak ke client
 * sebelum user submit.
 *
 * Flow:
 *   1. User submit { quiz_id, answers: number[] }
 *   2. Server fetch quiz (dengan correct_idx)
 *   3. Hitung score
 *   4. Insert attempt (UNIQUE constraint cegah duplicate per user × quiz)
 *   5. Award credits ke profile
 *   6. Return full result + correct_idx + explanations
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/db/supabase";
import { creditsForScore, type QuizQuestion } from "@/lib/quiz/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    quiz_id?: string;
    answers?: (number | null)[];
  } | null;

  if (!body?.quiz_id || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "quiz_id dan answers wajib" },
      { status: 400 },
    );
  }

  const cookieStore = cookies();
  const sb = getServerSupabase(cookieStore);
  if (!sb) {
    return NextResponse.json(
      { error: "Database belum di-setup" },
      { status: 503 },
    );
  }

  // Cek user
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Login dulu" }, { status: 401 });
  }
  const userId = auth.user.id;

  // Cek apakah user sudah pernah submit quiz ini
  const { data: existing } = await sb
    .from("quiz_attempts")
    .select("id, score, total, credits_awarded")
    .eq("user_id", userId)
    .eq("quiz_id", body.quiz_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error: "Kamu sudah mengerjakan kuis ini minggu ini. Tunggu refresh berikutnya.",
        already_submitted: true,
        previous: existing,
      },
      { status: 409 },
    );
  }

  // Fetch quiz
  const { data: quiz, error: qErr } = await sb
    .from("quizzes")
    .select("id, title, category, questions")
    .eq("id", body.quiz_id)
    .single();
  if (qErr || !quiz) {
    return NextResponse.json({ error: "Quiz tidak ditemukan" }, { status: 404 });
  }

  const questions = quiz.questions as QuizQuestion[];
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "Quiz rusak" }, { status: 500 });
  }

  // Skor
  let score = 0;
  const corrections = questions.map((q, i) => {
    const chosen = body.answers![i];
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
  const creditsAwarded = creditsForScore(score, total);

  // Insert attempt (unique → kalau ada race, akan reject — OK)
  const { error: insErr } = await sb.from("quiz_attempts").insert({
    user_id: userId,
    quiz_id: quiz.id,
    answers: body.answers,
    score,
    total,
    credits_awarded: creditsAwarded,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Award credits (RPC supaya atomic)
  if (creditsAwarded > 0) {
    await sb.rpc("award_quiz_credits", {
      p_user_id: userId,
      p_credits: creditsAwarded,
    });
  }

  return NextResponse.json({
    ok: true,
    quiz_id: quiz.id,
    title: quiz.title,
    score,
    total,
    pct: Math.round((score / total) * 100),
    credits_awarded: creditsAwarded,
    corrections,
  });
}
