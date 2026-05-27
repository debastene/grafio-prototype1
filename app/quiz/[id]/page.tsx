"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import {
  ArrowLeft, ArrowRight, Check, X, Loader2, AlertCircle,
  Trophy, Sparkles, Coins, RotateCcw, Brain,
} from "lucide-react";
import { getBrowserSupabase, SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import { CATEGORY_LABEL, CATEGORY_EMOJI, type QuizQuestion } from "@/lib/quiz/types";

type Quiz = {
  id: string;
  title: string;
  category: "datsci" | "common";
  // Soal yang ditampilkan ke user — TIDAK termasuk correct_idx & explanation
  // (kita strip di client biar tidak ngintip via devtools). correct_idx & explanation
  // dikembalikan setelah submit oleh /api/quiz/submit.
  questions: { q: string; choices: string[] }[];
};

type Correction = {
  idx: number;
  chosen: number | null;
  correct_idx: number;
  is_correct: boolean;
  explanation: string;
  question: string;
  choices: string[];
};

type Result = {
  score: number;
  total: number;
  pct: number;
  credits_awarded: number;
  corrections: Correction[];
};

export default function QuizPlayerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  /** True kalau user pernah submit minggu ini → show readonly result */
  const [previousAttempt, setPreviousAttempt] = useState<{
    score: number;
    total: number;
    credits_awarded: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!SUPABASE_CONFIGURED) {
        setError("Database belum di-setup.");
        setLoading(false);
        return;
      }
      const sb = getBrowserSupabase();
      if (!sb) {
        setError("Supabase tidak tersedia.");
        setLoading(false);
        return;
      }
      const { data: auth } = await sb.auth.getUser();
      if (!auth?.user) {
        router.push("/login?next=/quiz");
        return;
      }

      // Cek kalau user sudah pernah submit
      const { data: existing } = await sb
        .from("quiz_attempts")
        .select("score, total, credits_awarded")
        .eq("user_id", auth.user.id)
        .eq("quiz_id", params.id)
        .maybeSingle();

      const { data: q, error: qErr } = await sb
        .from("quizzes")
        .select("id, title, category, questions")
        .eq("id", params.id)
        .single();
      if (cancelled) return;
      if (qErr || !q) {
        setError("Quiz tidak ditemukan atau sudah kadaluwarsa.");
        setLoading(false);
        return;
      }

      const rawQs = q.questions as QuizQuestion[];
      const stripped: Quiz = {
        id: q.id,
        title: q.title,
        category: q.category,
        questions: rawQs.map((qq) => ({ q: qq.q, choices: qq.choices })),
      };
      setQuiz(stripped);
      setAnswers(new Array(stripped.questions.length).fill(null));
      if (existing) {
        setPreviousAttempt({
          score: existing.score,
          total: existing.total,
          credits_awarded: existing.credits_awarded,
        });
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const submit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quiz.id, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal submit");
        if (data.previous) {
          setPreviousAttempt(data.previous);
        }
        return;
      }
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== RENDER =====

  if (loading) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan" />
        </div>
      </PageShell>
    );
  }

  if (error && !quiz) {
    return (
      <PageShell>
        <div className="glass rounded-2xl p-10 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-danger mb-3" />
          <p className="text-white font-syne font-bold text-lg mb-1">Oops</p>
          <p className="text-sm text-muted">{error}</p>
          <Link
            href="/quiz"
            className="inline-block mt-4 px-4 py-2 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm"
          >
            Kembali ke daftar
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!quiz) return null;

  // Already attempted this week → readonly summary
  if (previousAttempt && !result) {
    return (
      <PageShell>
        <ResultView
          quiz={quiz}
          score={previousAttempt.score}
          total={previousAttempt.total}
          pct={Math.round((previousAttempt.score / previousAttempt.total) * 100)}
          credits_awarded={previousAttempt.credits_awarded}
          corrections={null}
          previousOnly
        />
      </PageShell>
    );
  }

  if (result) {
    return (
      <PageShell>
        <ResultView quiz={quiz} {...result} />
      </PageShell>
    );
  }

  const q = quiz.questions[current];
  const chosen = answers[current];
  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === quiz.questions.length;

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">{CATEGORY_EMOJI[quiz.category]}</span>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cyan">
              {CATEGORY_LABEL[quiz.category]}
            </p>
            <h1 className="font-syne font-bold text-white text-base">{quiz.title}</h1>
          </div>
        </div>
        <Link
          href="/quiz"
          className="text-xs text-muted hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Batal & kembali
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted">
            Soal <span className="text-white">{current + 1}</span> dari {quiz.questions.length}
          </span>
          <span className="text-mint">
            {answeredCount}/{quiz.questions.length} terisi
          </span>
        </div>
        <div className="h-1.5 bg-bgSurface rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan transition-all"
            style={{ width: `${((current + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="glass rounded-2xl p-6 mb-4 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
        <p className="text-[10px] uppercase tracking-widest text-cyan mb-2">
          Pertanyaan #{current + 1}
        </p>
        <p className="text-white font-syne text-lg leading-relaxed">{q.q}</p>
      </div>

      {/* Choices */}
      <div className="space-y-2 mb-6">
        {q.choices.map((choice, i) => {
          const selected = chosen === i;
          return (
            <button
              key={i}
              onClick={() => {
                const next = [...answers];
                next[current] = i;
                setAnswers(next);
              }}
              className={`w-full text-left flex items-start gap-3 rounded-md border p-3.5 transition-all ${
                selected
                  ? "border-cyan bg-cyan/10 shadow-glow"
                  : "border-borderColor bg-bgSurface hover:border-cyan/50"
              }`}
            >
              <span
                className={`w-6 h-6 flex-shrink-0 rounded-md flex items-center justify-center text-xs font-bold ${
                  selected
                    ? "bg-cyan text-bgDeep"
                    : "bg-bgElevated text-muted border border-borderColor"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-sm text-white flex-1 leading-relaxed">{choice}</span>
            </button>
          );
        })}
      </div>

      {/* Nav controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
          className="px-4 py-2 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Sebelumnya
        </button>

        {current < quiz.questions.length - 1 ? (
          <button
            onClick={() => setCurrent(current + 1)}
            className="px-5 py-2 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow flex items-center gap-1.5 font-syne"
          >
            Lanjut <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting || !allAnswered}
            title={!allAnswered ? "Jawab semua soal dulu" : "Submit jawaban"}
            className="px-5 py-2 rounded-md bg-mint text-bgDeep font-semibold hover:opacity-90 transition-all text-sm shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-syne"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Submit Jawaban
              </>
            )}
          </button>
        )}
      </div>

      {/* Question hop nav */}
      <div className="mt-6 pt-4 border-t border-borderColor">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Lompat ke soal</p>
        <div className="flex flex-wrap gap-1.5">
          {quiz.questions.map((_, i) => {
            const answered = answers[i] !== null;
            const isCurrent = i === current;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-md text-xs font-mono font-bold flex items-center justify-center transition-all ${
                  isCurrent
                    ? "bg-cyan text-bgDeep shadow-glow"
                    : answered
                      ? "bg-mint/10 border border-mint/30 text-mint hover:bg-mint/20"
                      : "bg-bgSurface border border-borderColor text-muted hover:border-cyan/50"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </PageShell>
  );
}

// ============================================================
// RESULT VIEW
// ============================================================

function ResultView({
  quiz,
  score,
  total,
  pct,
  credits_awarded,
  corrections,
  previousOnly,
}: {
  quiz: Quiz;
  score: number;
  total: number;
  pct: number;
  credits_awarded: number;
  corrections: Correction[] | null;
  previousOnly?: boolean;
}) {
  const grade =
    pct >= 90 ? "excellent" : pct >= 70 ? "great" : pct >= 50 ? "ok" : "low";
  const gradeMeta = {
    excellent: { label: "Luar biasa!", color: "text-mint", bg: "border-mint/40 bg-mint/10" },
    great: { label: "Bagus!", color: "text-cyan", bg: "border-cyan/40 bg-cyan/10" },
    ok: { label: "Cukup", color: "text-warning", bg: "border-warning/40 bg-warning/10" },
    low: { label: "Coba lagi minggu depan", color: "text-danger", bg: "border-danger/40 bg-danger/10" },
  }[grade];

  return (
    <>
      <div className={`glass rounded-2xl p-8 text-center mb-6 border ${gradeMeta.bg}`}>
        <Trophy className={`w-12 h-12 mx-auto mb-3 ${gradeMeta.color}`} />
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
          {previousOnly ? "Hasil minggu ini" : "Skor kamu"}
        </p>
        <p className={`text-5xl font-syne font-bold ${gradeMeta.color}`}>
          {score}/{total}
        </p>
        <p className="text-sm text-white mt-2">
          <span className={`font-syne font-semibold ${gradeMeta.color}`}>
            {gradeMeta.label}
          </span>{" "}
          · {pct}% benar
        </p>

        {credits_awarded > 0 ? (
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-warning/15 border border-warning/40">
            <Coins className="w-3.5 h-3.5 text-warning" />
            <span className="text-sm font-syne font-bold text-warning">
              +{credits_awarded} credits {previousOnly ? "" : "ditambahkan"}!
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted mt-4 italic">
            Belum dapat credits — skor minimal 50% biar dapat bonus.
          </p>
        )}

        {previousOnly && (
          <p className="text-[11px] text-muted mt-3 leading-relaxed max-w-md mx-auto">
            Kuis ini sudah kamu kerjain minggu ini. Tunggu refresh Senin 00:00 WIB untuk
            soal baru.
          </p>
        )}
      </div>

      {/* Per-question breakdown */}
      {corrections && (
        <div className="space-y-3 mb-6">
          <h3 className="font-syne font-bold text-white text-sm mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan" /> Review Jawaban
          </h3>
          {corrections.map((c) => (
            <div
              key={c.idx}
              className={`glass rounded-xl p-4 border ${
                c.is_correct
                  ? "border-mint/25 bg-mint/5"
                  : "border-danger/25 bg-danger/5"
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <span
                  className={`w-6 h-6 flex-shrink-0 rounded-md flex items-center justify-center ${
                    c.is_correct
                      ? "bg-mint/20 text-mint"
                      : "bg-danger/20 text-danger"
                  }`}
                >
                  {c.is_correct ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    Soal #{c.idx + 1}
                  </p>
                  <p className="text-sm text-white leading-relaxed mt-0.5">{c.question}</p>
                </div>
              </div>

              <div className="space-y-1 mb-3 pl-9">
                {c.choices.map((choice, i) => {
                  const isCorrect = i === c.correct_idx;
                  const isChosen = i === c.chosen;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                        isCorrect
                          ? "bg-mint/10 text-mint"
                          : isChosen
                            ? "bg-danger/10 text-danger line-through"
                            : "text-muted"
                      }`}
                    >
                      <span className="font-mono text-[10px] w-4">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="flex-1">{choice}</span>
                      {isCorrect && <Check className="w-3 h-3" />}
                      {isChosen && !isCorrect && <X className="w-3 h-3" />}
                    </div>
                  );
                })}
              </div>

              <div className="pl-9">
                <div className="rounded-md bg-bgElevated/60 border border-borderColor px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-cyan mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Penjelasan
                  </p>
                  <p className="text-xs text-white leading-relaxed">{c.explanation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/quiz"
          className="px-4 py-2 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Daftar Quiz
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-md bg-cyan text-bgDeep font-semibold text-sm hover:bg-cyanSoft transition-colors flex items-center gap-1.5 font-syne"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Pakai credits → Analisis
        </Link>
      </div>
    </>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />
      <div className="relative max-w-3xl mx-auto px-6 py-10">{children}</div>
      <Footer />
    </main>
  );
}
