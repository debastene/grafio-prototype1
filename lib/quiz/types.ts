/**
 * Quiz types. Cermin tabel di supabase/quiz_schema.sql.
 */

export type QuizCategory = "datsci" | "common";

export const CATEGORY_LABEL: Record<QuizCategory, string> = {
  datsci: "Data Science",
  common: "Pengetahuan Umum",
};

export const CATEGORY_EMOJI: Record<QuizCategory, string> = {
  datsci: "📊",
  common: "🌍",
};

export type QuizQuestion = {
  q: string;
  /** 4 jawaban; correct_idx adalah index 0-3. */
  choices: string[];
  correct_idx: number;
  /** 1 paragraf kenapa jawaban itu yang benar. */
  explanation: string;
};

export type QuizRow = {
  id: string;
  week_start: string; // ISO date
  category: QuizCategory;
  slot: number;
  title: string;
  questions: QuizQuestion[];
  generated_by: string | null;
  created_at: string;
};

export type QuizAttemptRow = {
  id: string;
  user_id: string;
  quiz_id: string;
  /** Array of chosen indexes — null jika user skip. */
  answers: (number | null)[];
  score: number;
  total: number;
  credits_awarded: number;
  created_at: string;
};

/**
 * Calculate credits awarded based on score percentage.
 * Reward scale di-tune kecil sengaja supaya user masih tertarik subscribe.
 */
export function creditsForScore(score: number, total: number): number {
  if (total === 0) return 0;
  const pct = score / total;
  if (pct >= 0.9) return 3;
  if (pct >= 0.7) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

/**
 * Senin minggu ini (WIB). Buat key "week_start" supaya quiz refresh weekly.
 * WIB = UTC+7. Quiz refresh Senin 00:00 WIB = Minggu 17:00 UTC.
 */
export function thisWeekStartWIB(now: Date = new Date()): string {
  // Konversi ke WIB
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Senin = 1. Hitung mundur ke Senin terakhir.
  const daysSinceMon = (day + 6) % 7;
  const monday = new Date(wib.getTime() - daysSinceMon * 24 * 60 * 60 * 1000);
  // Zero out time
  return monday.toISOString().slice(0, 10);
}

export function isSamePublicQuiz(row: QuizRow, weekStart: string): boolean {
  return row.week_start === weekStart;
}
