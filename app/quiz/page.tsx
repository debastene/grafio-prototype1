"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import {
  Sparkles, Trophy, Lock, Check, Brain, BookOpen,
  Loader2, AlertCircle, Coins, Calendar,
} from "lucide-react";
import { getBrowserSupabase, SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import {
  CATEGORY_LABEL, CATEGORY_EMOJI, thisWeekStartWIB,
  type QuizRow, type QuizCategory, type QuizAttemptRow,
} from "@/lib/quiz/types";

type QuizCardData = {
  quiz: Pick<QuizRow, "id" | "title" | "category" | "slot" | "questions">;
  attempt: Pick<QuizAttemptRow, "score" | "total" | "credits_awarded"> | null;
};

export default function QuizListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QuizCardData[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!SUPABASE_CONFIGURED) {
        setError("Database belum di-setup. Quiz belum bisa dipakai di environment ini.");
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
        setNeedLogin(true);
        setLoading(false);
        return;
      }

      const weekStart = thisWeekStartWIB();
      // Fetch quizzes minggu ini + attempt user paralel
      const [{ data: quizzes, error: qErr }, { data: attempts }] = await Promise.all([
        sb
          .from("quizzes")
          .select("id, title, category, slot, questions")
          .eq("week_start", weekStart)
          .order("category")
          .order("slot"),
        sb
          .from("quiz_attempts")
          .select("quiz_id, score, total, credits_awarded")
          .eq("user_id", auth.user.id),
      ]);
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }

      const attemptByQuiz = new Map(
        (attempts ?? []).map((a) => [a.quiz_id, a]),
      );
      const cards: QuizCardData[] = (quizzes ?? []).map((q) => ({
        quiz: q as QuizCardData["quiz"],
        attempt: attemptByQuiz.get(q.id) ?? null,
      }));
      setItems(cards);

      // Credits
      const { data: profile } = await sb
        .from("profiles")
        .select("credits")
        .eq("id", auth.user.id)
        .single();
      if (profile) setCredits(profile.credits ?? 0);

      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped: Record<QuizCategory, QuizCardData[]> = { datsci: [], common: [] };
  for (const c of items) grouped[c.quiz.category].push(c);

  const weekLabel = formatWeekRange(thisWeekStartWIB());

  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />
      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan mb-2">Mini Quiz</p>
            <h1 className="text-3xl md:text-4xl font-syne font-bold text-white">
              Seru-seruan Belajar
            </h1>
            <p className="text-muted text-sm mt-1 flex items-center gap-2 flex-wrap">
              <Calendar className="w-3.5 h-3.5" />
              Minggu ini · <span className="text-white">{weekLabel}</span>
              <span className="text-muted/50">·</span>
              Quiz refresh tiap Senin 00:00 WIB
            </p>
          </div>
          {credits !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber/30 bg-amber/10">
              <Coins className="w-4 h-4 text-warning" />
              <span className="text-sm font-syne font-bold text-warning">
                {credits} credits
              </span>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="glass rounded-2xl p-5 mb-6 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-syne font-bold text-white text-sm mb-1">
                Jawab 10 soal — dapat credits bonus
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Skor ≥90% = <span className="text-mint font-semibold">+3 credits</span>{" "}
                · 70-89% = <span className="text-cyan font-semibold">+2 credits</span>{" "}
                · 50-69% = <span className="text-warning font-semibold">+1 credit</span>.
                Credits bisa kamu pakai untuk bonus analisis / upload di luar quota.
                Tiap quiz cuma bisa dikerjain 1× per minggu — pilih dengan bijak!
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan" />
            <p className="text-sm text-muted mt-3">Memuat quiz minggu ini…</p>
          </div>
        ) : needLogin ? (
          <EmptyState
            icon={<Lock className="w-10 h-10" />}
            title="Login dulu, dong"
            desc="Quiz butuh akun aktif biar bisa simpan skor & award credits."
            cta={
              <Link
                href="/login?next=/quiz"
                className="px-4 py-2 rounded-md bg-cyan text-bgDeep text-sm font-semibold hover:bg-cyanSoft transition-colors"
              >
                Login
              </Link>
            }
          />
        ) : error ? (
          <EmptyState
            icon={<AlertCircle className="w-10 h-10 text-danger" />}
            title="Quiz belum tersedia"
            desc={error}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Trophy className="w-10 h-10 text-muted" />}
            title="Quiz minggu ini belum di-generate"
            desc="Admin sedang menyiapkan soal baru. Coba balik lagi nanti — biasanya siap Senin pagi."
          />
        ) : (
          <div className="space-y-8">
            {(["datsci", "common"] as QuizCategory[]).map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                items={grouped[cat]}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

function CategorySection({
  category,
  items,
}: {
  category: QuizCategory;
  items: QuizCardData[];
}) {
  const Icon = category === "datsci" ? Brain : BookOpen;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{CATEGORY_EMOJI[category]}</span>
        <h2 className="font-syne font-bold text-white text-xl">{CATEGORY_LABEL[category]}</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted bg-bgSurface border border-borderColor px-2 py-0.5 rounded-full">
          {items.length} quiz
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted italic">
          Tidak ada quiz {CATEGORY_LABEL[category]} minggu ini.
        </p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {items.map(({ quiz, attempt }) => (
            <QuizCard key={quiz.id} quiz={quiz} attempt={attempt} Icon={Icon} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuizCard({
  quiz,
  attempt,
  Icon,
}: {
  quiz: QuizCardData["quiz"];
  attempt: QuizCardData["attempt"];
  Icon: any;
}) {
  const done = !!attempt;
  const pct = done ? Math.round((attempt!.score / attempt!.total) * 100) : null;
  return (
    <Link
      href={`/quiz/${quiz.id}`}
      className={`group bg-bgSurface border rounded-xl p-5 transition-all shadow-soft hover:-translate-y-0.5 ${
        done
          ? "border-mint/30 hover:border-mint/60"
          : "border-borderColor hover:border-cyan/60 hover:shadow-glow"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted">
          Quiz #{quiz.slot}
        </span>
      </div>
      <h3 className="font-syne font-bold text-white text-base leading-tight mb-1">
        {quiz.title}
      </h3>
      <p className="text-xs text-muted">{quiz.questions.length} soal · ~5 menit</p>

      <div className="mt-4 pt-3 border-t border-borderColor">
        {done ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-mint flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Selesai · {attempt!.score}/{attempt!.total} ({pct}%)
            </span>
            {attempt!.credits_awarded > 0 && (
              <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/30">
                +{attempt!.credits_awarded} credits
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-cyan font-semibold group-hover:underline">
            Mulai Kuis →
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="text-muted mx-auto w-fit mb-3">{icon}</div>
      <h3 className="font-syne font-bold text-white text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">{desc}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("id", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}
