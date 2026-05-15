/**
 * Pure statistical functions. Operates on number[] (already cleaned of nulls).
 */

export type Summary = {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  std: number;
  variance: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  cv: number; // coefficient of variation
};

export function clean(arr: (number | null | undefined)[]): number[] {
  return arr.filter((v): v is number => typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v));
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function summarize(arr: number[]): Summary {
  const n = arr.length;
  if (n === 0) {
    return {
      count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, range: 0,
      std: 0, variance: 0, q1: 0, q3: 0, iqr: 0, skewness: 0, cv: 0,
    };
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const min = sorted[0];
  const max = sorted[n - 1];
  // Sample skewness (Fisher-Pearson, biased) — m3/m2^1.5
  const skewness = std === 0
    ? 0
    : arr.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / n;
  return {
    count: n,
    sum,
    mean,
    median,
    min,
    max,
    range: max - min,
    std,
    variance,
    q1,
    q3,
    iqr: q3 - q1,
    skewness,
    cv: mean === 0 ? 0 : std / Math.abs(mean),
  };
}

/**
 * Pearson correlation coefficient. Returns 0 if undefined.
 */
export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/**
 * Simple linear regression via OLS. Returns slope, intercept, r-squared.
 */
export type LinReg = { slope: number; intercept: number; r2: number };

export function linreg(x: number[], y: number[]): LinReg {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
    syy += y[i] * y[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = (() => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const yhat = slope * x[i] + intercept;
      s += (y[i] - yhat) ** 2;
    }
    return s;
  })();
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/**
 * Z-score outlier detection. Returns indices of outliers in original array.
 * threshold: typically 2.5 (moderate) or 3 (strict).
 */
export function zOutliers(arr: number[], threshold = 2.5): { indices: number[]; values: number[]; zscores: number[] } {
  const s = summarize(arr);
  const indices: number[] = [];
  const values: number[] = [];
  const zscores: number[] = [];
  if (s.std === 0) return { indices, values, zscores };
  for (let i = 0; i < arr.length; i++) {
    const z = (arr[i] - s.mean) / s.std;
    if (Math.abs(z) >= threshold) {
      indices.push(i);
      values.push(arr[i]);
      zscores.push(z);
    }
  }
  return { indices, values, zscores };
}

/**
 * IQR outlier detection. Robust to non-normal distributions.
 */
export function iqrOutliers(arr: number[], k = 1.5): { indices: number[]; values: number[] } {
  const s = summarize(arr);
  const lo = s.q1 - k * s.iqr;
  const hi = s.q3 + k * s.iqr;
  const indices: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < lo || arr[i] > hi) {
      indices.push(i);
      values.push(arr[i]);
    }
  }
  return { indices, values };
}

/**
 * Frequency table for categorical data, sorted descending.
 */
export function freq<T extends string | number | boolean>(arr: T[]): { value: T; count: number; pct: number }[] {
  const m = new Map<T, number>();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  const total = arr.length;
  return Array.from(m.entries())
    .map(([value, count]) => ({ value, count, pct: count / total }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Group rows by a key column and aggregate one numeric column.
 */
export function groupBy<T>(
  rows: T[],
  keyFn: (r: T) => string | number | null,
  valFn: (r: T) => number | null,
): Map<string | number, number[]> {
  const m = new Map<string | number, number[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const v = valFn(r);
    if (k === null || v === null || !Number.isFinite(v)) continue;
    const arr = m.get(k) ?? [];
    arr.push(v);
    m.set(k, arr);
  }
  return m;
}

/**
 * Compact a number for display: 1234567 -> "1.2M".
 */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

/**
 * Format a number based on detected col type.
 */
export function formatByType(n: number, type: string, name?: string): string {
  if (type === "percent") return `${(n * 100).toFixed(1)}%`;
  if (type === "currency") {
    const lower = (name ?? "").toLowerCase();
    if (lower.includes("idr") || lower.includes("rp") || lower.includes("rupiah")) {
      return `Rp ${compactNumber(n)}`;
    }
    return `$${compactNumber(n)}`;
  }
  return compactNumber(n);
}
