/**
 * Cross-column analysis — uses intent to bias which columns become primary.
 */

import { ColProfile } from "./profile";
import { isNumericType, ParsedRow, ColType } from "./parse";
import { clean, linreg, pearson, zOutliers, groupBy, summarize } from "./stats";
import { ParsedIntent } from "./intent";

export type TrendResult = {
  column: string;
  slope: number;
  r2: number;
  direction: "naik" | "turun" | "datar";
  pctChange: number;
  startValue: number;
  endValue: number;
  // For forecast: extrapolated next 3 points
  forecast: number[];
};

export type Correlation = {
  a: string;
  b: string;
  r: number;
  strength: "lemah" | "sedang" | "kuat" | "sangat kuat";
  direction: "positif" | "negatif";
};

export type AnomalyResult = {
  column: string;
  count: number;
  topExample: { rowIndex: number; value: number; zscore: number } | null;
};

export type SegmentResult = {
  groupCol: string;
  metricCol: string;
  groups: { name: string; count: number; mean: number; sum: number }[];
  topGroup: { name: string; value: number };
  bottomGroup: { name: string; value: number };
  spread: number;
};

export type CorrMatrix = {
  columns: string[];
  matrix: number[][]; // [i][j] = pearson(col[i], col[j])
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
 * Forecast next k points via simple linear extrapolation.
 */
function forecastLinear(xs: number[], ys: number[], k: number): number[] {
  if (xs.length < 2) return [];
  const lr = linreg(xs, ys);
  const last = xs[xs.length - 1];
  const step = xs.length > 1 ? (last - xs[0]) / (xs.length - 1) : 1;
  const out: number[] = [];
  for (let i = 1; i <= k; i++) {
    out.push(lr.slope * (last + step * i) + lr.intercept);
  }
  return out;
}

/**
 * Decide best primary chart type given data shape + user intent.
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
    return hasDate || numericCount > 0 ? "line" : "bar";
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

  const numericCols = profiles.filter((p) => isNumericType(p.type) && !p.isLikelyId).map((p) => p.name);
  const categoricalCols = profiles.filter((p) => p.type === "categorical" || p.type === "boolean").map((p) => p.name);
  const dateCols = profiles.filter((p) => p.isLikelyDate).map((p) => p.name);

  // Rank numeric cols with focus boost
  const ranked = [...profiles]
    .filter((p) => isNumericType(p.type) && !p.isLikelyId)
    .sort((a, b) => importance(b, focusSet) - importance(a, focusSet));
  const primaryNumericCols = ranked.slice(0, 6).map((p) => p.name);

  // Pick primary date / category, allowing intent override
  const intentDate = intent?.focusColumns.find((c) =>
    profiles.find((p) => p.name === c)?.isLikelyDate,
  );
  const primaryDateCol = intentDate ?? dateCols[0] ?? null;

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

  // ===== TRENDS
  const trends: TrendResult[] = [];
  const trendXs = (() => {
    if (primaryDateCol) {
      const dp = profiles.find((p) => p.name === primaryDateCol)!;
      return dp.numericVector ?? [];
    }
    return null;
  })();

  for (const numName of primaryNumericCols.slice(0, 5)) {
    const numPr = profiles.find((p) => p.name === numName);
    if (!numPr?.numericVector) continue;
    const ys = numPr.numericVector;
    let pairs: [number, number][] = [];
    if (trendXs) {
      for (let i = 0; i < trendXs.length; i++) {
        if (Number.isFinite(trendXs[i]) && Number.isFinite(ys[i])) pairs.push([trendXs[i], ys[i]]);
      }
    } else {
      const cleanY = clean(ys);
      pairs = cleanY.map((y, i) => [i, y]);
    }
    if (pairs.length < 3) continue;
    pairs.sort((a, b) => a[0] - b[0]);
    const xv = pairs.map((p) => p[0]);
    const yv = pairs.map((p) => p[1]);
    const lr = linreg(xv, yv);
    const startValue = yv[0];
    const endValue = yv[yv.length - 1];
    const pct = startValue === 0 ? 0 : ((endValue - startValue) / Math.abs(startValue)) * 100;
    const dir: TrendResult["direction"] =
      Math.abs(lr.r2) < 0.05 || Math.abs(pct) < 2 ? "datar" : lr.slope > 0 ? "naik" : "turun";
    const forecast = forecastLinear(xv, yv, 3);
    trends.push({
      column: numName,
      slope: lr.slope,
      r2: lr.r2,
      direction: dir,
      pctChange: pct,
      startValue,
      endValue,
      forecast,
    });
  }

  // ===== CORRELATIONS
  const correlations: Correlation[] = [];
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
      const r = pearson(xs, ys);
      if (Math.abs(r) < 0.3) continue;
      correlations.push({
        a: a.name,
        b: b.name,
        r,
        strength: strengthLabel(r),
        direction: r > 0 ? "positif" : "negatif",
      });
    }
  }
  correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

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

  // ===== ANOMALIES
  const anomalies: AnomalyResult[] = [];
  for (const numName of primaryNumericCols) {
    const p = profiles.find((x) => x.name === numName);
    if (!p?.numericVector) continue;
    const cleaned = clean(p.numericVector);
    if (cleaned.length < 5) continue;
    const r = zOutliers(cleaned, 2.5);
    if (r.indices.length === 0) continue;

    let maxIdx = 0;
    for (let i = 1; i < r.zscores.length; i++) {
      if (Math.abs(r.zscores[i]) > Math.abs(r.zscores[maxIdx])) maxIdx = i;
    }
    let cleanedCounter = -1;
    let originalIdx = -1;
    for (let i = 0; i < p.numericVector.length; i++) {
      if (Number.isFinite(p.numericVector[i])) {
        cleanedCounter++;
        if (cleanedCounter === r.indices[maxIdx]) {
          originalIdx = i;
          break;
        }
      }
    }

    anomalies.push({
      column: numName,
      count: r.indices.length,
      topExample: {
        rowIndex: originalIdx,
        value: r.values[maxIdx],
        zscore: r.zscores[maxIdx],
      },
    });
  }
  anomalies.sort((a, b) => b.count - a.count);

  // ===== SEGMENTS
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
      if (groups.size < 2) continue;
      const groupStats = Array.from(groups.entries()).map(([name, vals]) => {
        const s = summarize(vals);
        return { name: String(name), count: vals.length, mean: s.mean, sum: s.sum };
      });
      groupStats.sort((a, b) => b.mean - a.mean);
      if (groupStats.length === 0) continue;
      const top = groupStats[0];
      const bot = groupStats[groupStats.length - 1];
      const overallMean = groupStats.reduce((a, g) => a + g.mean, 0) / groupStats.length;
      segments.push({
        groupCol: primaryCategoryCol,
        metricCol: metric,
        groups: groupStats.slice(0, 12),
        topGroup: { name: top.name, value: top.mean },
        bottomGroup: { name: bot.name, value: bot.mean },
        spread: overallMean === 0 ? 0 : (top.mean - bot.mean) / Math.abs(overallMean),
      });
    }
    segments.sort((a, b) => b.spread - a.spread);
  }

  const kpiCandidates = primaryNumericCols.slice(0, 4).map((name) => {
    const p = profiles.find((x) => x.name === name)!;
    const trend = trends.find((t) => t.column === name);
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
    !!primaryDateCol,
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
    primaryChartType,
    intentApplied: intent,
    filteredRowIndices,
  };
}
