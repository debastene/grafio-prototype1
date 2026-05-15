/**
 * Parse a user prompt into structured directives that drive analysis.
 *
 * The prompt is matched against:
 *   - intent keywords (trend / anomaly / correlation / segment / forecast / ranking)
 *   - column names (fuzzy substring match)
 *   - cell values (e.g., "Indonesia", "2023") for filtering / highlighting
 */

import { ColProfile } from "./profile";
import { ParsedRow } from "./parse";

export type IntentTag =
  | "trend"
  | "anomaly"
  | "correlation"
  | "segment"
  | "forecast"
  | "compare"
  | "ranking"
  | "summary"
  | "distribution";

export type ParsedIntent = {
  raw: string;
  tags: Set<IntentTag>;
  focusColumns: string[]; // column names matched by user tokens, ordered by score
  focusValues: string[]; // raw cell values mentioned (e.g., "Indonesia")
  focusValueColumns: string[]; // columns that contain those values
  topN: number | null; // explicit "top 5", "10 teratas" etc
  primaryFocus: string | null; // the single most-emphasized column
};

const INTENT_PATTERNS: Array<{ tag: IntentTag; words: string[] }> = [
  { tag: "trend", words: ["tren", "trend", "naik", "turun", "growth", "pertumbuhan", "berkembang", "perkembangan", "evolusi", "evolution", "selama waktu", "over time", "time series"] },
  { tag: "anomaly", words: ["anomali", "anomaly", "outlier", "outliers", "aneh", "ekstrem", "extreme", "tidak biasa", "unusual"] },
  { tag: "correlation", words: ["korelasi", "correlation", "hubungan", "relationship", "berkaitan", "related", "pengaruh", "vs", "dengan", "and"] },
  { tag: "segment", words: ["segmen", "segment", "kategori", "category", "kelompok", "group", "per "] },
  { tag: "forecast", words: ["forecast", "prediksi", "predict", "proyeksi", "projection", "ramalan", "future", "depan", "extrapolate"] },
  { tag: "compare", words: ["bandingkan", "banding", "compare", "comparison", "perbandingan", "vs", "dibanding"] },
  { tag: "ranking", words: ["top", "teratas", "tertinggi", "terbaik", "rank", "ranking", "urutkan", "sort", "terendah", "terburuk", "bottom", "paling"] },
  { tag: "summary", words: ["ringkas", "summary", "summarize", "rangkum", "ringkasan", "executive", "overview"] },
  { tag: "distribution", words: ["distribusi", "distribution", "sebaran", "histogram", "frekuensi", "frequency", "share", "proporsi", "proportion", "persentase"] },
];

/**
 * Tokenize prompt into meaningful words (drop stopwords).
 */
const STOPWORDS = new Set([
  "untuk", "dari", "yang", "ini", "itu", "saya", "data", "analisis", "tolong",
  "the", "of", "for", "with", "on", "at", "to", "from", "this", "that",
  "please", "can", "you", "show", "tampilkan", "tunjukkan", "kasih", "berikan",
  "lihat", "lihatkan", "carikan", "cari", "find", "berapa", "apa", "saja", "agar",
  "sesuai", "yang", "dengan", "dan", "atau", "or", "tapi", "but", "lalu", "kemudian",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Score how well a column name matches user tokens. Higher = better.
 */
function scoreColumn(name: string, tokens: string[]): number {
  const n = name.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (n === t) score += 8;
    else if (n.split(/[_\s\-./]/).includes(t)) score += 5;
    else if (n.includes(t)) score += 3;
    else if (t.length >= 4 && n.length >= 4) {
      // Levenshtein-ish: prefix match
      if (n.startsWith(t.slice(0, 4)) || t.startsWith(n.slice(0, 4))) score += 1;
    }
  }
  return score;
}

/**
 * Find specific cell values mentioned in the prompt (categorical).
 * Returns the values and the columns that contain them.
 */
function findValueMentions(
  rawPrompt: string,
  rows: ParsedRow[],
  profiles: ColProfile[],
): { values: string[]; columns: string[] } {
  const values = new Set<string>();
  const columns = new Set<string>();
  const lower = rawPrompt.toLowerCase();
  // Only check categorical columns with reasonable cardinality
  for (const p of profiles) {
    if (p.type !== "categorical" && p.type !== "boolean" && p.type !== "text") continue;
    if (!p.topValues) continue;
    for (const tv of p.topValues) {
      const v = String(tv.value).toLowerCase();
      if (v.length < 3) continue;
      if (lower.includes(v)) {
        values.add(String(tv.value));
        columns.add(p.name);
      }
    }
  }
  return { values: Array.from(values), columns: Array.from(columns) };
}

function extractTopN(prompt: string): number | null {
  const m = prompt.match(/\b(top|teratas|terbawah|bottom)\s*(\d+)|\b(\d+)\s*(teratas|terbawah|tertinggi|terendah|terbaik)/i);
  if (m) {
    const n = parseInt(m[2] ?? m[3], 10);
    if (!Number.isNaN(n) && n >= 2 && n <= 100) return n;
  }
  return null;
}

export function parseIntent(
  rawPrompt: string,
  profiles: ColProfile[],
  rows: ParsedRow[],
): ParsedIntent {
  const trimmed = rawPrompt.trim();
  const tags = new Set<IntentTag>();
  if (!trimmed) {
    return {
      raw: trimmed,
      tags,
      focusColumns: [],
      focusValues: [],
      focusValueColumns: [],
      topN: null,
      primaryFocus: null,
    };
  }

  const lower = trimmed.toLowerCase();

  // Match intent tags
  for (const { tag, words } of INTENT_PATTERNS) {
    for (const w of words) {
      if (lower.includes(w)) {
        tags.add(tag);
        break;
      }
    }
  }

  // Tokenize and score each column
  const tokens = tokenize(trimmed);
  const scored = profiles
    .map((p) => ({ name: p.name, score: scoreColumn(p.name, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const focusColumns = scored.map((x) => x.name);

  // Match values
  const { values, columns } = findValueMentions(trimmed, rows, profiles);

  return {
    raw: trimmed,
    tags,
    focusColumns,
    focusValues: values,
    focusValueColumns: columns,
    topN: extractTopN(trimmed),
    primaryFocus: focusColumns[0] ?? null,
  };
}
