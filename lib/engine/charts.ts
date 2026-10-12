/**
 * Convert analysis output into chart-ready data series for the dashboard.
 */

import { Analysis, aggregationFor, formatTimeLabel, resolveTimeX } from "./analyze";
import { ColProfile } from "./profile";
import { ParsedRow } from "./parse";
import { aggregateSeries, freq, summarize, clean } from "./stats";

export type SeriesData = {
  labels: string[];
  series: { label: string; data: number[] }[];
};

export type DistributionData = {
  labels: string[];
  data: number[];
};

export type ScatterPoints = {
  xLabel: string;
  yLabel: string;
  points: { x: number; y: number }[];
};

export type HistogramData = {
  column: string;
  bins: { label: string; count: number; lo: number; hi: number }[];
};

export type ChartBundle = {
  primary: SeriesData;
  primaryType: "line" | "bar" | "scatter" | "doughnut" | "histogram" | "stacked";
  primaryTitle: string;

  distribution: DistributionData | null;
  scatter: ScatterPoints | null;
  stacked: SeriesData | null;
  histogram: HistogramData | null;

  // Forecast extension of primary trend (next 3 points)
  forecastSeries: SeriesData | null;

  preview: { headers: string[]; rows: (string | number | boolean | null)[][] };
  recommended: string[];
};

/**
 * Build a histogram from a numeric column.
 */
function buildHistogram(name: string, values: number[], bins = 12): HistogramData {
  const cleaned = clean(values);
  if (cleaned.length === 0) return { column: name, bins: [] };
  // Jangan Math.min(...arr): spread >~120k elemen = "Maximum call stack size exceeded".
  let min = Infinity;
  let max = -Infinity;
  for (const v of cleaned) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    return {
      column: name,
      bins: [{ label: String(min), count: cleaned.length, lo: min, hi: max }],
    };
  }
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of cleaned) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx]++;
  }
  const out = counts.map((count, i) => {
    const lo = min + step * i;
    const hi = lo + step;
    return {
      label: formatBinLabel(lo, hi),
      count,
      lo,
      hi,
    };
  });
  return { column: name, bins: out };
}

function formatBinLabel(lo: number, hi: number): string {
  const span = hi - lo;
  const decimals = span >= 100 ? 0 : span >= 10 ? 1 : 2;
  return `${lo.toFixed(decimals)}–${hi.toFixed(decimals)}`;
}

export function shapeCharts(
  analysis: Analysis,
  profiles: ColProfile[],
  rows: ParsedRow[],
  headers: string[],
): ChartBundle {
  const primaryNumeric = analysis.primaryNumericCols.slice(0, 3);
  const dateCol = analysis.primaryDateCol;
  const catCol = analysis.primaryCategoryCol;

  // Determine primary based on engine recommendation
  let primary: SeriesData = { labels: [], series: [] };
  let primaryTitle = "Data";
  let forecastSeries: SeriesData | null = null;
  let histogram: HistogramData | null = null;
  const wantedType = analysis.primaryChartType;

  if (wantedType === "line" && analysis.timeAxis) {
    // Deret waktu: SATU titik per periode (agregasi sum/mean), bukan per baris.
    // Dulu tiap baris diplot apa adanya → data transaksi jadi garis zig-zag.
    const axis = analysis.timeAxis;
    const timeX = resolveTimeX(profiles, axis);
    const MAX_POINTS = 60;
    let labels: string[] = [];
    let bucketed = false;
    const series = primaryNumeric.map((col) => {
      const pr = profiles.find((p) => p.name === col)!;
      const agg = aggregationFor(pr);
      const s = aggregateSeries(timeX, pr.numericVector ?? [], agg);
      let xs = s.x;
      let ys = s.y;
      if (xs.length > MAX_POINTS) {
        const b = rebucket(xs, ys, MAX_POINTS, agg);
        xs = b.x;
        ys = b.y;
        bucketed = true;
      }
      if (labels.length === 0) labels = xs.map((x) => formatTimeLabel(x, axis.kind));
      return { label: agg === "sum" ? `Total ${col}` : `Rata-rata ${col}`, data: ys, column: col };
    });
    primary = { labels, series: series.map(({ label, data }) => ({ label, data })) };
    primaryTitle = `Tren — ${primaryNumeric.join(" · ")} per periode`;

    // Forecast extension dari tren utama (hanya kalau signifikan & skala periode sama)
    const topTrend = analysis.trends.find((t) => t.significant && t.forecast.length);
    if (topTrend && !bucketed) {
      const main = series.find((s) => s.column === topTrend.column);
      if (main) {
        const fLabels = [...labels];
        const fData = [...main.data];
        for (let i = 0; i < topTrend.forecast.length; i++) {
          fLabels.push(`+${i + 1}`);
          fData.push(topTrend.forecast[i]);
        }
        forecastSeries = {
          labels: fLabels,
          series: [
            { label: `${topTrend.column} (aktual + forecast)`, data: fData },
          ],
        };
      }
    }
  } else if (wantedType === "bar" || wantedType === "stacked") {
    if (catCol && primaryNumeric.length > 0) {
      const metric = primaryNumeric[0];
      const grouped = new Map<string, number[]>();
      const metricPr = profiles.find((p) => p.name === metric)!;
      rows.forEach((r, idx) => {
        const k = r[catCol];
        const v = metricPr.numericVector?.[idx];
        if (k === null || k === undefined) return;
        const key = String(k);
        const arr = grouped.get(key) ?? [];
        if (typeof v === "number" && Number.isFinite(v)) arr.push(v);
        grouped.set(key, arr);
      });
      const sorted = Array.from(grouped.entries())
        .map(([k, vs]) => ({ k, mean: summarize(vs).mean, sum: summarize(vs).sum }))
        .sort((a, b) => b.mean - a.mean)
        .slice(0, analysis.intentApplied?.topN ?? 12);
      primary = {
        labels: sorted.map((x) => x.k),
        series: [{ label: `Rata-rata ${metric}`, data: sorted.map((x) => x.mean) }],
      };
      primaryTitle = `${metric} per ${catCol} (top ${sorted.length})`;
    } else {
      // No category — show column means
      const labels = primaryNumeric;
      const data = primaryNumeric.map((c) => profiles.find((p) => p.name === c)?.summary?.mean ?? 0);
      primary = { labels, series: [{ label: "Rata-rata kolom", data }] };
      primaryTitle = "Rata-rata per kolom";
    }
  } else if (wantedType === "scatter") {
    if (analysis.correlations.length > 0) {
      const c = analysis.correlations[0];
      const a = profiles.find((p) => p.name === c.a);
      const b = profiles.find((p) => p.name === c.b);
      if (a?.numericVector && b?.numericVector) {
        // Render as fake series for ChartSwitcher (it expects numeric data per label)
        // But scatter is rendered separately in the dashboard via aiResult.charts.scatter
        primary = { labels: [], series: [] };
        primaryTitle = `${c.a} vs ${c.b} (korelasi r=${c.r.toFixed(2)})`;
      }
    }
  } else if (wantedType === "histogram") {
    if (primaryNumeric.length > 0) {
      const col = primaryNumeric[0];
      const pr = profiles.find((p) => p.name === col);
      if (pr?.numericVector) {
        histogram = buildHistogram(col, pr.numericVector, 12);
        primary = {
          labels: histogram.bins.map((b) => b.label),
          series: [{ label: `Frekuensi ${col}`, data: histogram.bins.map((b) => b.count) }],
        };
        primaryTitle = `Distribusi ${col}`;
      }
    }
  }

  // Fallback: if primary is still empty, build column means bar
  if (primary.series.length === 0 && primaryNumeric.length > 0) {
    const labels = primaryNumeric;
    const data = primaryNumeric.map((c) => profiles.find((p) => p.name === c)?.summary?.mean ?? 0);
    primary = { labels, series: [{ label: "Rata-rata kolom", data }] };
    primaryTitle = "Rata-rata per kolom";
  }

  // ====== DISTRIBUTION
  let distribution: DistributionData | null = null;
  if (catCol) {
    const values = rows
      .map((r) => r[catCol])
      .filter((v): v is string | number | boolean => v !== null && v !== undefined && v !== "")
      .map(String);
    const f = freq(values).slice(0, 8);
    if (f.length >= 2) {
      distribution = {
        labels: f.map((x) => String(x.value)),
        data: f.map((x) => x.count),
      };
    }
  }

  // ====== SCATTER
  let scatter: ScatterPoints | null = null;
  if (analysis.correlations.length > 0) {
    const c = analysis.correlations[0];
    const a = profiles.find((p) => p.name === c.a);
    const b = profiles.find((p) => p.name === c.b);
    if (a?.numericVector && b?.numericVector) {
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < a.numericVector.length; i++) {
        const x = a.numericVector[i];
        const y = b.numericVector[i];
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      }
      const capped = points.length > 200 ? sampleEvenly(points, 200) : points;
      scatter = { xLabel: c.a, yLabel: c.b, points: capped };
    }
  }

  // ====== STACKED
  let stacked: SeriesData | null = null;
  if (catCol && primaryNumeric.length >= 2) {
    const cats = (() => {
      const f = freq(
        rows
          .map((r) => r[catCol])
          .filter((v): v is string | number | boolean => v !== null && v !== undefined && v !== "")
          .map(String),
      );
      return f.slice(0, 8).map((x) => String(x.value));
    })();
    if (cats.length >= 2) {
      const series = primaryNumeric.slice(0, 3).map((m) => {
        const mPr = profiles.find((p) => p.name === m)!;
        const data = cats.map((cat) => {
          let sum = 0;
          for (let i = 0; i < rows.length; i++) {
            if (String(rows[i][catCol]) === cat) {
              const v = mPr.numericVector?.[i];
              if (typeof v === "number" && Number.isFinite(v)) sum += v;
            }
          }
          return sum;
        });
        return { label: m, data };
      });
      stacked = { labels: cats, series };
    }
  }

  // Build a histogram if not already built (for the dashboard's "Distribution Detail" panel)
  if (!histogram && primaryNumeric.length > 0) {
    const col = primaryNumeric[0];
    const pr = profiles.find((p) => p.name === col);
    if (pr?.numericVector) histogram = buildHistogram(col, pr.numericVector, 12);
  }

  const previewRows = rows.slice(0, 10).map((r) =>
    headers.map((h) => {
      const v = r[h];
      return v === null || v === undefined ? null : v;
    }),
  );

  // ===== RECOMMENDED chart types
  const recommended: string[] = [];
  recommended.push(wantedType);
  if (dateCol && wantedType !== "line") recommended.push("line");
  if (distribution && !recommended.includes("doughnut")) recommended.push("doughnut");
  if (scatter && !recommended.includes("scatter")) recommended.push("scatter");
  if (stacked && !recommended.includes("stacked")) recommended.push("stacked");
  if (analysis.correlationMatrix && !recommended.includes("heatmap")) recommended.push("heatmap");
  if (recommended.length === 0) recommended.push("bar");

  return {
    primary,
    primaryType: wantedType,
    primaryTitle,
    distribution,
    scatter,
    stacked,
    histogram,
    forecastSeries,
    preview: { headers, rows: previewRows },
    recommended,
  };
}

/** Gabungkan periode berurutan jadi `buckets` kelompok (sum/mean), label = x pertama. */
function rebucket(
  xs: number[],
  ys: number[],
  buckets: number,
  agg: "sum" | "mean",
): { x: number[]; y: number[] } {
  const size = Math.ceil(xs.length / buckets);
  const outX: number[] = [];
  const outY: number[] = [];
  for (let i = 0; i < xs.length; i += size) {
    const chunk = ys.slice(i, i + size);
    const sum = chunk.reduce((a, b) => a + b, 0);
    outX.push(xs[i]);
    outY.push(agg === "sum" ? sum : sum / chunk.length);
  }
  return { x: outX, y: outY };
}

function sampleEvenly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
