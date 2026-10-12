/**
 * Column profiler — for each column, infer type, compute stats,
 * detect distribution shape, missingness, uniqueness, top values.
 */

import {
  ColType,
  ParsedRow,
  coerceValue,
  detectDateOrder,
  inferColType,
  isNumericType,
  monthIndex,
} from "./parse";
import { Summary, summarize, freq, clean, iqrOutliers } from "./stats";

/**
 * Jenis sumbu waktu sebuah kolom:
 *   - "epoch": tanggal/waktu → epoch ms (UTC)
 *   - "year":  angka tahun (2019, 2020, …) di kolom bernama tahun/year
 *   - "month": nomor bulan 1-12 (dari angka atau nama bulan "Januari"/"Jan")
 */
export type TimeKind = "epoch" | "year" | "month";

export type ColProfile = {
  name: string;
  type: ColType;
  index: number;

  total: number;
  missing: number;
  missingPct: number;
  unique: number;
  uniqueRatio: number;

  // For numeric/percent/currency/date columns
  summary?: Summary;
  /** Jumlah nilai di luar pagar Tukey 1.5×IQR (hanya kolom numerik, bukan waktu). */
  outlierCount?: number;
  outlierPct?: number;

  // For categorical/boolean
  topValues?: { value: string; count: number; pct: number }[];

  // Pre-computed numeric vector (aligned with row order, nulls preserved as NaN)
  numericVector?: number[];

  /** Kalau kolom ini sumbu waktu: jenisnya + nilai numerik per baris (NaN = kosong). */
  timeKind?: TimeKind;
  timeVector?: number[];

  // Heuristic flags
  isLikelyId: boolean;
  isLikelyDate: boolean;
  isLikelyTarget: boolean; // looks like a "main metric" (revenue, sales, score, count, total, value...)
};

const TARGET_HINTS = [
  "revenue", "sales", "income", "profit", "score", "rating", "count",
  "total", "value", "amount", "price", "gdp", "population", "users",
  "growth", "performance", "lifeexp", "expectancy", "literacy",
  "penjualan", "pendapatan", "laba", "skor", "nilai", "jumlah", "omzet", "harga",
];

/** Token nama kolom yang menandakan identifier (dicocokkan per TOKEN, bukan substring). */
const ID_TOKENS = new Set([
  "id", "uuid", "guid", "key", "kode", "code", "sku", "nik", "nim", "nrp", "nip", "npwp", "isbn", "zip", "kodepos",
]);

const DATE_TOKENS = new Set([
  "date", "datetime", "timestamp", "time", "tanggal", "tgl", "waktu", "created", "updated", "periode", "period",
]);
const YEAR_TOKENS = new Set(["year", "tahun", "thn", "yr"]);
const MONTH_TOKENS = new Set(["month", "bulan", "bln", "mon"]);

/**
 * Pecah nama kolom jadi token huruf kecil: "CustomerID" → [customer, id],
 * "paid_amount" → [paid, amount], "Land Area(Km2)" → [land, area, km2].
 *
 * Dulu pakai `name.includes("id")` sehingga "paid", "humidity", "width",
 * "dividend" ikut dianggap ID dan dibuang dari analisis.
 */
export function tokenizeName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasToken(tokens: string[], set: Set<string>): boolean {
  return tokens.some((t) => set.has(t));
}

function matchesTarget(tokens: string[]): boolean {
  return tokens.some((t) =>
    TARGET_HINTS.some((h) => t === h || (h.length >= 4 && t.startsWith(h))),
  );
}

/** Integer unik yang berurutan (1,2,3,… atau 101,102,…) → nomor baris/indeks. */
function isSequentialIndex(values: number[]): boolean {
  if (values.length < 3) return false;
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 1) return false;
  }
  return true;
}

export function profileTable(headers: string[], rows: ParsedRow[]): ColProfile[] {
  return headers.map((name, idx) => {
    const rawValues = rows.map((r) => r[name]);
    const total = rawValues.length;
    const missing = rawValues.filter((v) => v === null || v === undefined || v === "").length;
    const tokens = tokenizeName(name);

    const dateOrder = detectDateOrder(rawValues);
    const type = inferColType(rawValues, { dateOrder });

    // Coerce all values to typed form
    const coerced = rawValues.map((v) => coerceValue(v, { dateOrder }).value);
    const stringValues = coerced.filter((v) => v !== null).map(String);
    const unique = new Set(stringValues).size;
    const nonMissing = total - missing;

    let numericVector: number[] | undefined;
    let summary: Summary | undefined;
    let outlierCount = 0;
    let topValues: ColProfile["topValues"];
    let timeKind: TimeKind | undefined;
    let timeVector: number[] | undefined;

    if (isNumericType(type) || type === "date") {
      numericVector = coerced.map((v) => (typeof v === "number" ? v : NaN));
      const cleaned = clean(numericVector);
      if (cleaned.length > 0) summary = summarize(cleaned);

      if (type === "date") {
        timeKind = "epoch";
        timeVector = numericVector;
      } else if (summary && (type === "integer" || type === "number")) {
        const allInt = cleaned.every((v) => Number.isInteger(v));
        if (allInt && hasToken(tokens, YEAR_TOKENS) && summary.min >= 1800 && summary.max <= 2200) {
          timeKind = "year";
          timeVector = numericVector;
        } else if (allInt && hasToken(tokens, MONTH_TOKENS) && summary.min >= 1 && summary.max <= 12) {
          timeKind = "month";
          timeVector = numericVector;
        }
      }

      // Outlier hanya bermakna untuk metrik, bukan untuk sumbu waktu.
      if (isNumericType(type) && !timeKind && cleaned.length >= 5) {
        outlierCount = iqrOutliers(cleaned).indices.length;
      }
    } else if (type === "categorical" || type === "boolean" || type === "text") {
      if (type !== "text") {
        const f = freq(stringValues);
        topValues = f.slice(0, 10).map((x) => ({
          value: String(x.value),
          count: x.count,
          pct: x.pct,
        }));
      }
      // Kolom berisi nama bulan ("Januari", "Feb", …) → sumbu waktu ordinal.
      if (nonMissing > 0) {
        const months = rawValues.map((v) =>
          v === null || v === undefined || v === "" ? NaN : monthIndex(String(v)) ?? NaN,
        );
        const recognized = months.filter((m) => Number.isFinite(m)).length;
        if (recognized === nonMissing) {
          timeKind = "month";
          timeVector = months;
        }
      }
    }

    const numericValues = numericVector ? clean(numericVector) : [];
    const valueLooksLikeId =
      nonMissing > 1 &&
      unique === nonMissing &&
      !timeKind &&
      ((type === "text" || type === "categorical") ||
        (type === "integer" && isSequentialIndex(numericValues)));

    return {
      name,
      type,
      index: idx,
      total,
      missing,
      missingPct: total > 0 ? missing / total : 0,
      unique,
      uniqueRatio: total > 0 ? unique / total : 0,
      summary,
      outlierCount,
      outlierPct: summary && summary.count > 0 ? outlierCount / summary.count : 0,
      topValues,
      numericVector,
      timeKind,
      timeVector,
      isLikelyId: !timeKind && (hasToken(tokens, ID_TOKENS) || valueLooksLikeId),
      isLikelyDate:
        !!timeKind ||
        // Nama seperti "tanggal"/"date" tapi isinya tidak terbaca: tandai, tapi
        // analyze hanya memakai kolom dengan timeVector sebagai sumbu x.
        (hasToken(tokens, DATE_TOKENS) && type === "date"),
      isLikelyTarget: matchesTarget(tokens) && isNumericType(type) && !timeKind,
    };
  });
}
