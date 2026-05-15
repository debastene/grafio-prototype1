/**
 * Column profiler — for each column, infer type, compute stats,
 * detect distribution shape, missingness, uniqueness, top values.
 */

import {
  ColType,
  ParsedRow,
  coerceValue,
  inferColType,
  isNumericType,
} from "./parse";
import { Summary, summarize, freq, clean, zOutliers } from "./stats";

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
  outlierCount?: number;
  outlierPct?: number;

  // For categorical/boolean
  topValues?: { value: string; count: number; pct: number }[];

  // Pre-computed numeric vector (aligned with row order, nulls preserved as NaN)
  numericVector?: number[];

  // Heuristic flags
  isLikelyId: boolean;
  isLikelyDate: boolean;
  isLikelyTarget: boolean; // looks like a "main metric" (revenue, sales, score, count, total, value...)
};

const TARGET_HINTS = [
  "revenue", "sales", "income", "profit", "score", "rating", "count",
  "total", "value", "amount", "price", "gdp", "population", "users",
  "growth", "performance", "lifeexp", "expectancy", "literacy",
  "penjualan", "pendapatan", "laba", "skor", "nilai", "jumlah",
];

const ID_HINTS = ["id", "uuid", "key", "code", "kode", "sku"];

const DATE_HINTS = ["date", "time", "tanggal", "year", "month", "tahun", "bulan", "created", "updated"];

function isLikelyMatch(name: string, hints: string[]): boolean {
  const n = name.toLowerCase();
  return hints.some((h) => n === h || n.includes(h));
}

export function profileTable(headers: string[], rows: ParsedRow[]): ColProfile[] {
  return headers.map((name, idx) => {
    const rawValues = rows.map((r) => r[name]);
    const total = rawValues.length;
    const missing = rawValues.filter((v) => v === null || v === undefined || v === "").length;

    const type = inferColType(rawValues);

    // Coerce all values to typed form
    const coerced = rawValues.map((v) => coerceValue(v).value);
    const stringValues = coerced.filter((v) => v !== null).map(String);
    const unique = new Set(stringValues).size;

    let numericVector: number[] | undefined;
    let summary: Summary | undefined;
    let outlierCount = 0;
    let topValues: ColProfile["topValues"];

    if (isNumericType(type) || type === "date") {
      numericVector = coerced.map((v) => (typeof v === "number" ? v : NaN));
      const cleaned = clean(numericVector);
      if (cleaned.length > 0) {
        summary = summarize(cleaned);
        if (cleaned.length >= 5) {
          outlierCount = zOutliers(cleaned, 2.5).indices.length;
        }
      }
    } else if (type === "categorical" || type === "boolean") {
      const f = freq(stringValues);
      topValues = f.slice(0, 10).map((x) => ({
        value: String(x.value),
        count: x.count,
        pct: x.pct,
      }));
    }

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
      outlierPct: summary ? outlierCount / summary.count : 0,
      topValues,
      numericVector,
      isLikelyId:
        isLikelyMatch(name, ID_HINTS) ||
        (unique === total - missing && total > 1 && type !== "number" && type !== "currency" && type !== "percent"),
      isLikelyDate: type === "date" || isLikelyMatch(name, DATE_HINTS),
      isLikelyTarget: isLikelyMatch(name, TARGET_HINTS) && isNumericType(type),
    };
  });
}
