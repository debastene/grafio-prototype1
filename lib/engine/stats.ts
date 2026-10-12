/**
 * Pure statistical functions. Operates on number[] (already cleaned of nulls).
 *
 * Konvensi:
 *   - Variansi & std memakai pembagi (n − 1) — estimator tak bias untuk SAMPEL.
 *     Data yang diupload user hampir selalu sampel dari proses yang lebih besar.
 *   - Skewness memakai G1 (adjusted Fisher-Pearson), sama dengan Excel SKEW()
 *     dan pandas .skew().
 *   - Regresi & korelasi dihitung dari deviasi terhadap rata-rata (terpusat)
 *     supaya tidak kena catastrophic cancellation saat x berupa timestamp epoch.
 */

export type Summary = {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  /** Simpangan baku sampel (pembagi n − 1). */
  std: number;
  /** Variansi sampel (pembagi n − 1). */
  variance: number;
  q1: number;
  q3: number;
  iqr: number;
  /** Adjusted Fisher-Pearson G1; 0 kalau n < 3 atau data konstan. */
  skewness: number;
  cv: number; // coefficient of variation
};

export function clean(arr: (number | null | undefined)[]): number[] {
  return arr.filter((v): v is number => typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v));
}

/** Kuantil interpolasi linear (Hyndman-Fan tipe 7 — default R & numpy). */
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

  // Momen pusat ke-2 & ke-3 (pembagi n) untuk skewness; variansi sampel n − 1.
  let m2 = 0;
  let m3 = 0;
  for (const v of arr) {
    const d = v - mean;
    m2 += d * d;
    m3 += d * d * d;
  }
  const ss = m2;
  m2 /= n;
  m3 /= n;
  const variance = n > 1 ? ss / (n - 1) : 0;
  const std = Math.sqrt(variance);

  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const min = sorted[0];
  const max = sorted[n - 1];

  // G1 = g1 · √(n(n−1)) / (n−2), dengan g1 = m3 / m2^1.5
  const skewness =
    n < 3 || m2 === 0 ? 0 : (m3 / Math.pow(m2, 1.5)) * (Math.sqrt(n * (n - 1)) / (n - 2));

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

// ============================================================
// DISTRIBUSI t & F (untuk p-value) — Numerical Recipes, bab 6
// ============================================================

/** ln Γ(x) via aproksimasi Lanczos (g = 7, n = 9). Akurat ~1e-15. */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Refleksi: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction untuk incomplete beta (algoritma Lentz termodifikasi). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  // Pakai simetri supaya continued fraction konvergen cepat.
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** P(T ≤ t) untuk distribusi Student-t dengan df derajat bebas. */
export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const tail = 0.5 * regIncBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** p-value dua sisi untuk statistik t. */
export function tTwoSidedP(t: number, df: number): number {
  if (df <= 0 || Number.isNaN(t)) return 1;
  if (!Number.isFinite(t)) return 0;
  return regIncBeta(df / (df + t * t), df / 2, 0.5);
}

/** Kuantil t (invers CDF) via bisection — cukup untuk interval kepercayaan. */
export function tQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) return NaN;
  if (p === 0.5) return 0;
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

/** P(F > f) untuk distribusi F(d1, d2). */
export function fSurvival(f: number, d1: number, d2: number): number {
  if (d1 <= 0 || d2 <= 0 || Number.isNaN(f)) return 1;
  if (f <= 0) return 1;
  if (!Number.isFinite(f)) return 0;
  return regIncBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

// ============================================================
// KORELASI & REGRESI
// ============================================================

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

export type CorrTest = { r: number; n: number; pValue: number };

/**
 * Pearson r + uji H0: ρ = 0 (t = r·√((n−2)/(1−r²)), df = n − 2).
 */
export function pearsonTest(x: number[], y: number[]): CorrTest {
  const n = Math.min(x.length, y.length);
  const r = pearson(x, y);
  if (n < 3) return { r, n, pValue: 1 };
  if (Math.abs(r) >= 1 - 1e-12) return { r, n, pValue: 0 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return { r, n, pValue: tTwoSidedP(t, n - 2) };
}

/**
 * Simple linear regression via OLS. Returns slope, intercept, r-squared,
 * plus inferensi slope (SE, p-value) dan komponen untuk prediction interval.
 */
export type LinReg = {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
  /** Standard error slope; NaN kalau tidak terdefinisi. */
  slopeSE: number;
  /** p-value dua sisi untuk H0: slope = 0. */
  pValue: number;
  /** Simpangan baku residual s = √(SSE / (n − 2)). */
  residualSE: number;
  xMean: number;
  /** Σ(x − x̄)². */
  sxx: number;
};

export function linreg(x: number[], y: number[]): LinReg {
  const n = Math.min(x.length, y.length);
  const empty: LinReg = {
    slope: 0, intercept: 0, r2: 0, n, slopeSE: NaN, pValue: 1, residualSE: NaN, xMean: NaN, sxx: 0,
  };
  if (n < 2) return empty;

  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;

  // Terpusat — Σ(x−x̄)² dihitung langsung, BUKAN Σx² − (Σx)²/n.
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return { ...empty, intercept: my, xMean: mx };

  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const e = y[i] - (intercept + slope * x[i]);
    sse += e * e;
  }
  const r2 = syy === 0 ? 0 : Math.max(0, 1 - sse / syy);

  const df = n - 2;
  let residualSE = NaN;
  let slopeSE = NaN;
  let pValue = 1;
  if (df > 0) {
    residualSE = Math.sqrt(sse / df);
    slopeSE = residualSE / Math.sqrt(sxx);
    if (slopeSE > 0) pValue = tTwoSidedP(slope / slopeSE, df);
    else pValue = slope !== 0 ? 0 : 1; // fit sempurna
  }
  return { slope, intercept, r2, n, slopeSE, pValue, residualSE, xMean: mx, sxx };
}

/**
 * Prediction interval untuk SATU observasi baru di x0:
 *   ŷ ± t(1−α/2, n−2) · s · √(1 + 1/n + (x0 − x̄)² / Sxx)
 */
export function predictionInterval(
  lr: LinReg,
  x0: number,
  level = 0.95,
): { fit: number; lower: number; upper: number } {
  const fit = lr.intercept + lr.slope * x0;
  const df = lr.n - 2;
  if (df <= 0 || !Number.isFinite(lr.residualSE) || lr.sxx === 0) {
    return { fit, lower: NaN, upper: NaN };
  }
  const tq = tQuantile(1 - (1 - level) / 2, df);
  const half = tq * lr.residualSE * Math.sqrt(1 + 1 / lr.n + ((x0 - lr.xMean) ** 2) / lr.sxx);
  return { fit, lower: fit - half, upper: fit + half };
}

/**
 * Benjamini-Hochberg: ubah p-value jadi q-value (kontrol False Discovery Rate)
 * saat banyak hipotesis diuji sekaligus (mis. 15 pasangan korelasi).
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array<number>(m);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const val = Math.min(prev, (order[k].p * m) / (k + 1));
    prev = val;
    q[order[k].i] = Math.min(1, val);
  }
  return q;
}

/**
 * One-way ANOVA. Uji H0: semua rata-rata grup sama.
 */
export function oneWayAnova(groups: number[][]): { F: number; df1: number; df2: number; pValue: number } {
  const valid = groups.filter((g) => g.length > 0);
  const k = valid.length;
  const N = valid.reduce((a, g) => a + g.length, 0);
  const df1 = k - 1;
  const df2 = N - k;
  if (df1 <= 0 || df2 <= 0) return { F: NaN, df1, df2, pValue: 1 };
  const grand = valid.reduce((a, g) => a + g.reduce((s, v) => s + v, 0), 0) / N;
  let ssb = 0;
  let ssw = 0;
  for (const g of valid) {
    const m = g.reduce((s, v) => s + v, 0) / g.length;
    ssb += g.length * (m - grand) ** 2;
    for (const v of g) ssw += (v - m) ** 2;
  }
  if (ssw === 0) return { F: ssb > 0 ? Infinity : NaN, df1, df2, pValue: ssb > 0 ? 0 : 1 };
  const F = ssb / df1 / (ssw / df2);
  return { F, df1, df2, pValue: fSurvival(F, df1, df2) };
}

// ============================================================
// OUTLIER
// ============================================================

/**
 * Z-score outlier detection. Returns indices of outliers in original array.
 *
 * CATATAN: z-score klasik TIDAK robust — mean & std ikut tertarik oleh outlier
 * itu sendiri (masking), dan |z| maksimum untuk n titik hanya (n−1)/√n, jadi
 * untuk n ≤ 8 ambang 2.5 mustahil tercapai. Engine memakai iqrOutliers +
 * robustZScores; fungsi ini dipertahankan untuk kompatibilitas.
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

/** Pagar Tukey: [Q1 − k·IQR, Q3 + k·IQR] — sama dengan whisker boxplot. */
export function tukeyFences(arr: number[], k = 1.5): { lo: number; hi: number } {
  const s = summarize(arr);
  return { lo: s.q1 - k * s.iqr, hi: s.q3 + k * s.iqr };
}

/**
 * IQR outlier detection. Robust to non-normal distributions.
 */
export function iqrOutliers(arr: number[], k = 1.5): { indices: number[]; values: number[] } {
  const { lo, hi } = tukeyFences(arr, k);
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
 * Modified z-score (Iglewicz & Hoaglin, 1993): 0.6745·(x − median) / MAD.
 * |z*| > 3.5 lazim dianggap outlier ekstrem. Kalau MAD = 0 (>50% nilai sama),
 * fallback ke mean absolute deviation × 1.253314.
 */
export function robustZScores(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const sorted = [...arr].sort((a, b) => a - b);
  const med = quantile(sorted, 0.5);
  const absDev = arr.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = quantile(absDev, 0.5);
  if (mad > 0) return arr.map((v) => (0.6745 * (v - med)) / mad);
  const meanAD = absDev.reduce((a, b) => a + b, 0) / absDev.length;
  if (meanAD > 0) return arr.map((v) => (v - med) / (1.253314 * meanAD));
  return arr.map(() => 0);
}

// ============================================================
// UTIL
// ============================================================

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
 * Agregasi deret waktu: satu titik per nilai x unik (diurutkan), y = sum/mean
 * semua baris di periode itu. Data transaksi (banyak baris per tanggal) WAJIB
 * diagregasi dulu sebelum regresi tren — kalau tidak, "tren" hanya
 * membandingkan transaksi pertama vs terakhir.
 */
export function aggregateSeries(
  xs: number[],
  ys: number[],
  mode: "sum" | "mean",
): { x: number[]; y: number[]; counts: number[] } {
  const m = new Map<number, { s: number; c: number }>();
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const cur = m.get(x);
    if (cur) {
      cur.s += y;
      cur.c += 1;
    } else {
      m.set(x, { s: y, c: 1 });
    }
  }
  const keys = Array.from(m.keys()).sort((a, b) => a - b);
  return {
    x: keys,
    y: keys.map((k) => {
      const e = m.get(k)!;
      return mode === "sum" ? e.s : e.s / e.c;
    }),
    counts: keys.map((k) => m.get(k)!.c),
  };
}

/**
 * Sampling sistematik: ambil n elemen berjarak sama (k = N/n), deterministik.
 * Lebih representatif daripada "n baris teratas" kalau file terurut.
 */
export function systematicSample<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  if (arr.length <= n) return [...arr];
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step + step / 2)]);
  return out;
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

/** Format p-value untuk teks insight: "p<0.001" / "p=0.032". */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "p=–";
  if (p < 0.001) return "p<0.001";
  return `p=${p.toFixed(3)}`;
}
