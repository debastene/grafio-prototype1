/**
 * Cross-column analysis — uses intent to bias which columns become primary.
 *
 * Prinsip statistik yang dipegang di sini:
 *   - TREN hanya dihitung kalau ada sumbu waktu sungguhan (tanggal, tahun,
 *     bulan). Urutan baris BUKAN waktu — data cross-sectional (mis. negara
 *     urut abjad) tidak punya "tren".
 *   - Data dengan banyak baris per periode diagregasi dulu per periode.
 *   - Tren, korelasi, dan beda antar-segmen hanya dilaporkan kalau signifikan
 *     secara statistik (α = 5%), dengan koreksi Benjamini-Hochberg untuk
 *     banyak pasangan korelasi sekaligus.
 */

import { ColProfile, TimeKind } from "./profile";
import { isNumericType, ParsedRow, ColType } from "./parse";
import {
  aggregateSeries,
  benjaminiHochberg,
  groupBy,
  iqrOutliers,
  linreg,
  oneWayAnova,
  pearson,
  pearsonTest,
  predictionInterval,
  robustZScores,
  summarize,
} from "./stats";
import { ParsedIntent } from "./intent";

/** Tingkat signifikansi untuk semua uji di engine. */
export const ALPHA = 0.05;
/** Minimal anggota per grup supaya rata-rata grup layak dibandingkan. */
export const MIN_GROUP_SIZE = 3;

export type TrendResult = {
  column: string;
  slope: number;
  r2: number;
  direction: "naik" | "turun" | "datar";
  /** Perubahan % menurut GARIS TREN (fitted) dari periode pertama ke terakhir. */
  pctChange: number;
  /** Nilai garis tren di periode pertama & terakhir. */
  startValue: number;
  endValue: number;
  // For forecast: extrapolated next 3 points (kosong kalau tren tidak signifikan)
  forecast: number[];
  /** Batas bawah/atas prediction interval 95% untuk tiap titik forecast. */
  forecastLower?: number[];
  forecastUpper?: number[];
  /** p-value uji slope ≠ 0. */
  pValue?: number;
  significant?: boolean;
  /** Jumlah periode (titik setelah agregasi). */
  periods?: number;
  aggregation?: "sum" | "mean";
};

export type Correlation = {
  a: string;
  b: string;
  r: number;
  strength: "lemah" | "sedang" | "kuat" | "sangat kuat";
  direction: "positif" | "negatif";
  n?: number;
  pValue?: number;
  /** p-value setelah koreksi Benjamini-Hochberg. */
  qValue?: number;
};

export type AnomalyResult = {
  column: string;
  count: number;
  /**
   * Contoh paling ekstrem. `zscore` = modified z-score (median/MAD) —
   * nama field dipertahankan supaya snapshot project lama tetap terbaca.
   */
  topExample: { rowIndex: number; value: number; zscore: number } | null;
  /** Pagar Tukey yang dipakai: nilai di luar [lo, hi] dianggap outlier. */
  fences?: { lo: number; hi: number };
};

export type SegmentResult = {
  groupCol: string;
  metricCol: string;
  groups: { name: string; count: number; mean: number; sum: number }[];
  topGroup: { name: string; value: number };
  bottomGroup: { name: string; value: number };
  spread: number;
  /** p-value one-way ANOVA antar grup (yang anggotanya ≥ MIN_GROUP_SIZE). */
  pValue?: number;
  significant?: boolean;
};

export type CorrMatrix = {
  columns: string[];
  matrix: number[][]; // [i][j] = pearson(col[i], col[j])
};

/**
 * Metadata sumbu waktu (ringan — ikut tersimpan di snapshot). Nilai x per baris
 * dihitung ulang dari profile lewat resolveTimeX().
 */
export type TimeAxis = {
  column: string;
  kind: TimeKind | "yearMonth";
  /** Untuk kind "yearMonth": kolom tahun yang dipasangkan dengan kolom bulan. */
  yearColumn?: string;
};

export type Analysis = {
  rowCount: number;
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];

  trends: TrendResult[];
  correlations: Correlation[];
  correlationMatrix: CorrMatrix | null;
  anomalies: AnomalyResult[];
  segments: SegmentResult[];

  kpiCandidates: { name: string; type: ColType; total: number; mean: number; trend?: TrendResult }[];

  primaryDateCol: string | null;
  primaryCategoryCol: string | null;
  primaryNumericCols: string[];
  /** Sumbu waktu yang dipakai untuk tren (null = data tidak berdimensi waktu). */
  timeAxis?: TimeAxis | null;

  // Intent-driven directives
  primaryChartType: "line" | "bar" | "scatter" | "doughnut" | "histogram" | "stacked";
  intentApplied: ParsedIntent | null;
  filteredRowIndices: number[] | null; // when prompt mentioned values, indices of matching rows
};

function importance(p: ColProfile, focusBoost: Set<string>): number {
  let s = 0;
  if (focusBoost.has(p.name)) s += 200; // explicit user focus dominates
  if (p.isLikelyTarget) s += 100;
  if (isNumericType(p.type)) s += 30;
  if (p.summary) s += Math.min(20, Math.log10(Math.abs(p.summary.range) + 1) * 5);
  if (p.uniqueRatio > 0.05 && p.uniqueRatio < 0.95) s += 10;
  if (p.isLikelyId) s -= 50;
  if (p.missingPct > 0.5) s -= 30;
  return s;
}

function strengthLabel(r: number): Correlation["strength"] {
  const a = Math.abs(r);
  if (a >= 0.7) return "sangat kuat";
  if (a >= 0.5) return "kuat";
  if (a >= 0.3) return "sedang";
  return "lemah";
}

/**
 * Metrik aditif (uang, jumlah barang) dijumlah per periode; metrik rasio /
 * pengukuran (persen, suhu, rating) dirata-rata.
 */
export function aggregationFor(p: ColProfile): "sum" | "mean" {
  return p.type === "currency" || p.type === "integer" ? "sum" : "mean";
}

/**
 * Nilai x per baris untuk sebuah sumbu waktu (NaN = tidak ada).
 */
export function resolveTimeX(profiles: ColProfile[], axis: TimeAxis): number[] {
  const col = profiles.find((p) => p.name === axis.column);
  if (!col?.timeVector) return [];
  if (axis.kind !== "yearMonth") return col.timeVector;
  const year = profiles.find((p) => p.name === axis.yearColumn);
  if (!year?.timeVector) return [];
  return year.timeVector.map((y, i) => {
    const m = col.timeVector![i];
    return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + (m - 1) : NaN;
  });
}

/**
 * Pilih sumbu waktu. Urutan prioritas: kolom waktu yang disebut user →
 * tanggal (epoch) → tahun+bulan → tahun → bulan (kalau tiap bulan muncul sekali).
 */
export function pickTimeAxis(profiles: ColProfile[], intent: ParsedIntent | null): TimeAxis | null {
  const timeCols = profiles.filter((p) => p.timeKind && p.timeVector);
  if (timeCols.length === 0) return null;

  const finite = (v: number[]) => v.filter((x) => Number.isFinite(x));
  const usable = (v: number[]) => new Set(finite(v)).size >= 3;

  const focused = intent?.focusColumns
    .map((c) => timeCols.find((p) => p.name === c))
    .find((p): p is ColProfile => !!p);

  const epoch = timeCols.find((p) => p.timeKind === "epoch" && usable(p.timeVector!));
  const year = timeCols.find((p) => p.timeKind === "year");
  const month = timeCols.find((p) => p.timeKind === "month");

  const yearMonth = (): TimeAxis | null => {
    if (!year || !month) return null;
    const axis: TimeAxis = { column: month.name, kind: "yearMonth", yearColumn: year.name };
    return usable(resolveTimeX(profiles, axis)) ? axis : null;
  };
  const monthOnly = (): TimeAxis | null => {
    if (!month) return null;
    const v = finite(month.timeVector!);
    // Bulan berulang tanpa kolom tahun = campuran beberapa tahun → bukan sumbu linear.
    if (new Set(v).size !== v.length || !usable(v)) return null;
    return { column: month.name, kind: "month" };
  };

  if (focused?.timeKind === "epoch" && usable(focused.timeVector!)) {
    return { column: focused.name, kind: "epoch" };
  }
  if (epoch) return { column: epoch.name, kind: "epoch" };
  const ym = yearMonth();
  if (ym) return ym;
  if (year && usable(year.timeVector!)) return { column: year.name, kind: "year" };
  return monthOnly();
}

/** Jarak "satu periode" = median selisih antar periode berurutan. */
function typicalStep(xs: number[]): number {
  if (xs.length < 2) return 1;
  const diffs = [];
  for (let i = 1; i < xs.length; i++) diffs.push(xs[i] - xs[i - 1]);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 1;
}

/**
 * Tren satu metrik terhadap sumbu waktu: agregasi per periode → OLS →
 * uji slope → prediction interval untuk 3 periode ke depan.
 */
export function computeTrend(
  column: string,
  xRow: number[],
  yRow: number[],
  aggregation: "sum" | "mean",
): TrendResult | null {
  const series = aggregateSeries(xRow, yRow, aggregation);
  const xv = series.x;
  const yv = series.y;
  if (xv.length < 3) return null;

  const lr = linreg(xv, yv);
  const fitStart = lr.intercept + lr.slope * xv[0];
  const fitEnd = lr.intercept + lr.slope * xv[xv.length - 1];
  const pct = Math.abs(fitStart) < 1e-12 ? 0 : ((fitEnd - fitStart) / Math.abs(fitStart)) * 100;
  const significant = lr.pValue < ALPHA;
  const direction: TrendResult["direction"] =
    !significant || Math.abs(pct) < 2 ? "datar" : lr.slope > 0 ? "naik" : "turun";

  const forecast: number[] = [];
  const forecastLower: number[] = [];
  const forecastUpper: number[] = [];
  if (significant) {
    const step = typicalStep(xv);
    const last = xv[xv.length - 1];
    for (let i = 1; i <= 3; i++) {
      const pi = predictionInterval(lr, last + step * i);
      forecast.push(pi.fit);
      forecastLower.push(pi.lower);
      forecastUpper.push(pi.upper);
    }
  }

  return {
    column,
    slope: lr.slope,
    r2: lr.r2,
    direction,
    pctChange: pct,
    startValue: fitStart,
    endValue: fitEnd,
    forecast,
    forecastLower,
    forecastUpper,
    pValue: lr.pValue,
    significant,
    periods: xv.length,
    aggregation,
  };
}

/**
 * Decide best primary chart type given data shape + user intent.
 * Line chart hanya kalau ada sumbu waktu sungguhan.
 */
function pickPrimaryChart(
  intent: ParsedIntent | null,
  hasDate: boolean,
  hasCategory: boolean,
  numericCount: number,
  hasStrongCorrelation: boolean,
): Analysis["primaryChartType"] {
  // Explicit intent wins
  if (intent?.tags.has("trend") || intent?.tags.has("forecast")) {
    if (hasDate) return "line";
    return hasCategory && numericCount > 0 ? "bar" : "histogram";
  }
  if (intent?.tags.has("correlation")) return hasStrongCorrelation ? "scatter" : "bar";
  if (intent?.tags.has("distribution")) return hasCategory ? "doughnut" : "histogram";
  if (intent?.tags.has("ranking") || intent?.tags.has("compare")) return hasCategory ? "bar" : "histogram";
  if (intent?.tags.has("segment")) return hasCategory ? "stacked" : "bar";

  // Fall through to data-driven
  if (hasDate) return "line";
  if (hasCategory && numericCount > 0) return "bar";
  if (hasStrongCorrelation) return "scatter";
  if (numericCount === 1) return "histogram";
  return "bar";
}

export function analyzeTable(
  profiles: ColProfile[],
  rows: ParsedRow[],
  intent: ParsedIntent | null = null,
): Analysis {
  const rowCount = rows.length;
  const focusSet = new Set(intent?.focusColumns ?? []);

  const isMetric = (p: ColProfile) => isNumericType(p.type) && !p.isLikelyId && !p.timeKind;
  const numericCols = profiles.filter(isMetric).map((p) => p.name);
  const categoricalCols = profiles
    .filter((p) => (p.type === "categorical" || p.type === "boolean") && p.timeKind !== "month")
    .map((p) => p.name);
  const dateCols = profiles.filter((p) => p.timeKind).map((p) => p.name);

  // Rank numeric cols with focus boost
  const ranked = [...profiles]
    .filter(isMetric)
    .sort((a, b) => importance(b, focusSet) - importance(a, focusSet));
  const primaryNumericCols = ranked.slice(0, 6).map((p) => p.name);

  const timeAxis = pickTimeAxis(profiles, intent);
  const primaryDateCol = timeAxis?.column ?? null;

  const intentCat = intent?.focusValueColumns[0] ??
    intent?.focusColumns.find((c) => {
      const p = profiles.find((x) => x.name === c);
      return p && (p.type === "categorical" || p.type === "boolean");
    });
  const primaryCategoryCol =
    intentCat ??
    categoricalCols.find((c) => {
      const p = profiles.find((x) => x.name === c)!;
      return p.unique >= 2 && p.unique <= 30;
    }) ??
    categoricalCols[0] ??
    null;

  // ===== TRENDS (hanya kalau ada sumbu waktu)
  const trends: TrendResult[] = [];
  if (timeAxis) {
    const timeX = resolveTimeX(profiles, timeAxis);
    for (const numName of primaryNumericCols.slice(0, 5)) {
      const numPr = profiles.find((p) => p.name === numName);
      if (!numPr?.numericVector) continue;
      const t = computeTrend(numName, timeX, numPr.numericVector, aggregationFor(numPr));
      if (t) trends.push(t);
    }
  }

  // ===== CORRELATIONS — uji per pasangan + koreksi Benjamini-Hochberg
  const candidates: Correlation[] = [];
  for (let i = 0; i < primaryNumericCols.length; i++) {
    for (let j = i + 1; j < primaryNumericCols.length; j++) {
      const a = profiles.find((p) => p.name === primaryNumericCols[i]);
      const b = profiles.find((p) => p.name === primaryNumericCols[j]);
      if (!a?.numericVector || !b?.numericVector) continue;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < a.numericVector.length; k++) {
        const xv = a.numericVector[k];
        const yv = b.numericVector[k];
        if (Number.isFinite(xv) && Number.isFinite(yv)) {
          xs.push(xv);
          ys.push(yv);
        }
      }
      if (xs.length < 5) continue;
      const test = pearsonTest(xs, ys);
      candidates.push({
        a: a.name,
        b: b.name,
        r: test.r,
        strength: strengthLabel(test.r),
        direction: test.r > 0 ? "positif" : "negatif",
        n: test.n,
        pValue: test.pValue,
      });
    }
  }
  const qValues = benjaminiHochberg(candidates.map((c) => c.pValue ?? 1));
  candidates.forEach((c, i) => (c.qValue = qValues[i]));
  const correlations = candidates
    .filter((c) => Math.abs(c.r) >= 0.3 && (c.qValue ?? 1) < ALPHA)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  // ===== CORRELATION MATRIX (full, for heatmap)
  const matrixCols = primaryNumericCols.slice(0, 6);
  let correlationMatrix: CorrMatrix | null = null;
  if (matrixCols.length >= 2) {
    const matrix: number[][] = [];
    const vectors: Record<string, number[]> = {};
    for (const c of matrixCols) {
      vectors[c] = profiles.find((p) => p.name === c)?.numericVector ?? [];
    }
    for (let i = 0; i < matrixCols.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < matrixCols.length; j++) {
        if (i === j) {
          row.push(1);
          continue;
        }
        const a = vectors[matrixCols[i]];
        const b = vectors[matrixCols[j]];
        const xs: number[] = [];
        const ys: number[] = [];
        for (let k = 0; k < a.length; k++) {
          if (Number.isFinite(a[k]) && Number.isFinite(b[k])) {
            xs.push(a[k]);
            ys.push(b[k]);
          }
        }
        row.push(xs.length >= 5 ? pearson(xs, ys) : 0);
      }
      matrix.push(row);
    }
    correlationMatrix = { columns: matrixCols, matrix };
  }

  // ===== ANOMALIES — pagar Tukey 1.5×IQR (konsisten dengan boxplot & capping)
  const anomalies: AnomalyResult[] = [];
  for (const numName of primaryNumericCols) {
    const p = profiles.find((x) => x.name === numName);
    if (!p?.numericVector) continue;
    const originalIdx: number[] = [];
    const cleaned: number[] = [];
    p.numericVector.forEach((v, i) => {
      if (Number.isFinite(v)) {
        cleaned.push(v);
        originalIdx.push(i);
      }
    });
    if (cleaned.length < 5) continue;
    const out = iqrOutliers(cleaned);
    if (out.indices.length === 0) continue;

    const rz = robustZScores(cleaned);
    let best = out.indices[0];
    for (const i of out.indices) {
      if (Math.abs(rz[i]) > Math.abs(rz[best])) best = i;
    }
    const s = summarize(cleaned);
    anomalies.push({
      column: numName,
      count: out.indices.length,
      topExample: { rowIndex: originalIdx[best], value: cleaned[best], zscore: rz[best] },
      fences: { lo: s.q1 - 1.5 * s.iqr, hi: s.q3 + 1.5 * s.iqr },
    });
  }
  anomalies.sort((a, b) => b.count - a.count);

  // ===== SEGMENTS — one-way ANOVA, grup kecil (< MIN_GROUP_SIZE) diabaikan
  const segments: SegmentResult[] = [];
  if (primaryCategoryCol && primaryNumericCols.length > 0) {
    for (const metric of primaryNumericCols.slice(0, 3)) {
      const groups = groupBy(
        rows,
        (r) => {
          const v = r[primaryCategoryCol];
          return v === null || v === undefined ? null : String(v);
        },
        (r) => {
          const v = r[metric];
          return typeof v === "number" ? v : null;
        },
      );
      const eligible = Array.from(groups.entries()).filter(([, vals]) => vals.length >= MIN_GROUP_SIZE);
      if (eligible.length < 2) continue;
      const groupStats = eligible.map(([name, vals]) => {
        const s = summarize(vals);
        return { name: String(name), count: vals.length, mean: s.mean, sum: s.sum };
      });
      groupStats.sort((a, b) => b.mean - a.mean);
      const top = groupStats[0];
      const bot = groupStats[groupStats.length - 1];
      const overallMean = groupStats.reduce((a, g) => a + g.mean, 0) / groupStats.length;
      const anova = oneWayAnova(eligible.map(([, vals]) => vals));
      segments.push({
        groupCol: primaryCategoryCol,
        metricCol: metric,
        groups: groupStats.slice(0, 12),
        topGroup: { name: top.name, value: top.mean },
        bottomGroup: { name: bot.name, value: bot.mean },
        spread: overallMean === 0 ? 0 : (top.mean - bot.mean) / Math.abs(overallMean),
        pValue: anova.pValue,
        significant: anova.pValue < ALPHA,
      });
    }
    // Signifikan dulu, lalu spread terbesar.
    segments.sort((a, b) => Number(!!b.significant) - Number(!!a.significant) || b.spread - a.spread);
  }

  const kpiCandidates = primaryNumericCols.slice(0, 4).map((name) => {
    const p = profiles.find((x) => x.name === name)!;
    const trend = trends.find((t) => t.column === name && t.significant);
    return {
      name,
      type: p.type,
      total: p.summary?.sum ?? 0,
      mean: p.summary?.mean ?? 0,
      trend,
    };
  });

  // ===== Filtered row indices (if prompt mentioned cell values)
  let filteredRowIndices: number[] | null = null;
  if (intent && intent.focusValues.length > 0 && intent.focusValueColumns.length > 0) {
    filteredRowIndices = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      for (const col of intent.focusValueColumns) {
        const v = r[col];
        if (v === null || v === undefined) continue;
        const sv = String(v);
        if (intent.focusValues.some((fv) => sv === fv || sv.toLowerCase() === fv.toLowerCase())) {
          filteredRowIndices.push(i);
          break;
        }
      }
    }
  }

  const hasStrongCorr = correlations.length > 0 && Math.abs(correlations[0].r) >= 0.5;
  const primaryChartType = pickPrimaryChart(
    intent,
    !!timeAxis,
    !!primaryCategoryCol,
    primaryNumericCols.length,
    hasStrongCorr,
  );

  return {
    rowCount,
    numericCols,
    categoricalCols,
    dateCols,
    trends,
    correlations: correlations.slice(0, 8),
    correlationMatrix,
    anomalies: anomalies.slice(0, 6),
    segments: segments.slice(0, 3),
    kpiCandidates,
    primaryDateCol,
    primaryCategoryCol,
    primaryNumericCols,
    timeAxis,
    primaryChartType,
    intentApplied: intent,
    filteredRowIndices,
  };
}

/** Untuk sumbu x non-epoch (tahun / tahun-bulan / bulan) → label yang manusiawi. */
export function formatTimeLabel(x: number, kind: TimeAxis["kind"]): string {
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  if (kind === "year") return String(x);
  if (kind === "month") return BULAN[(x - 1 + 12) % 12] ?? String(x);
  if (kind === "yearMonth") return `${BULAN[x % 12]} ${Math.floor(x / 12)}`;
  const d = new Date(x);
  return Number.isNaN(d.getTime())
    ? String(x)
    : d.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
