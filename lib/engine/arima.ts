/**
 * ARIMA(p,d,q) — metodologi Box-Jenkins, dihitung 100% di browser.
 *
 *   1. Identifikasi : uji KPSS → orde differencing d (seperti forecast::ndiffs);
 *                     ACF & PACF deret yang sudah stasioner.
 *   2. Estimasi     : conditional sum of squares (CSS), dioptimasi Nelder-Mead.
 *                     Parameter ditransformasi (Jones 1980: tanh → PACF →
 *                     Durbin-Levinson) sehingga AR selalu stasioner dan MA selalu
 *                     invertibel. Orde (p,q) dipilih dengan AICc; semua kandidat
 *                     dikondisikan pada sampel efektif yang sama supaya AICc-nya
 *                     sebanding.
 *   3. Diagnostik   : uji Ljung-Box pada residual (white noise?).
 *   4. Peramalan    : rekursi model; interval dari bobot ψ (representasi MA(∞))
 *                     model penuh φ(B)(1−B)^d.
 *
 * Konvensi tanda (sama dengan R/statsmodels):
 *   w_t − μ = Σ φ_i (w_{t−i} − μ) + e_t + Σ θ_j e_{t−j},   w = ∇^d y
 * Untuk d = 0, μ = rata-rata deret; untuk d = 1, μ = drift (rata-rata kenaikan
 * per periode); untuk d = 2 tanpa konstanta.
 */

import { chiSquareSurvival } from "./stats";

// ============================================================
// UTIL
// ============================================================

function mean(x: number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return x.length ? s / x.length : 0;
}

function sd(x: number[]): number {
  const m = mean(x);
  let s = 0;
  for (const v of x) s += (v - m) ** 2;
  return x.length > 1 ? Math.sqrt(s / (x.length - 1)) : 0;
}

/** Differencing orde d: ∇^d x. */
export function difference(x: number[], d: number): number[] {
  let w = x.slice();
  for (let k = 0; k < d; k++) {
    const next: number[] = [];
    for (let i = 1; i < w.length; i++) next.push(w[i] - w[i - 1]);
    w = next;
  }
  return w;
}

/** Differencing musiman orde D dengan periode s: ∇_s^D x, ∇_s x_t = x_t − x_{t−s}. */
export function seasonalDifference(x: number[], s: number, D: number): number[] {
  let w = x.slice();
  for (let k = 0; k < D; k++) {
    const next: number[] = [];
    for (let i = s; i < w.length; i++) next.push(w[i] - w[i - s]);
    w = next;
  }
  return w;
}

/** Deret yang dimodelkan ARMA: ∇^d ∇_s^D y (musiman dulu, lalu biasa — operatornya komutatif). */
export function differenceAll(y: number[], d: number, D = 0, s = 0): number[] {
  return difference(D > 0 && s > 1 ? seasonalDifference(y, s, D) : y, d);
}

/** Ambang kekuatan musiman untuk difference musiman (forecast::nsdiffs, uji "seas"). */
export const SEASONAL_STRENGTH_THRESHOLD = 0.64;

/**
 * Kekuatan musiman F_s = max(0, 1 − Var(R)/Var(S + R)) dari dekomposisi
 * klasik aditif (Hyndman & Athanasopoulos, FPP): tren = moving average
 * terpusat orde s (2×s untuk s genap), S = indeks musiman rata-rata, R = sisa.
 * Mendekati 1 = pola musiman dominan. null kalau data < 2 musim penuh.
 */
export function seasonalStrength(y: number[], s: number): number | null {
  const n = y.length;
  if (s < 2 || n < 2 * s + 1) return null;
  const half = Math.floor(s / 2);
  const detr: { t: number; v: number }[] = [];
  for (let t = half; t < n - half; t++) {
    let sum = 0;
    if (s % 2 === 0) {
      sum += 0.5 * (y[t - half] + y[t + half]);
      for (let k = -half + 1; k <= half - 1; k++) sum += y[t + k];
    } else {
      for (let k = -half; k <= half; k++) sum += y[t + k];
    }
    detr.push({ t, v: y[t] - sum / s });
  }
  const idxSum = new Array<number>(s).fill(0);
  const idxCnt = new Array<number>(s).fill(0);
  for (const { t, v } of detr) {
    idxSum[t % s] += v;
    idxCnt[t % s]++;
  }
  const raw = idxSum.map((v, i) => (idxCnt[i] ? v / idxCnt[i] : 0));
  const center = mean(raw);
  const idx = raw.map((v) => v - center);
  const sr = detr.map(({ v }) => v);
  const r = detr.map(({ t, v }) => v - idx[t % s]);
  const variance = (x: number[]) => {
    const m = mean(x);
    let acc = 0;
    for (const v of x) acc += (v - m) ** 2;
    return acc / Math.max(1, x.length - 1);
  };
  const vSR = variance(sr);
  if (vSR < 1e-300) return 0;
  return Math.max(0, 1 - variance(r) / vSR);
}

// ============================================================
// ACF / PACF
// ============================================================

/** ACF sampel (penaksir bias, pembagi n — sama dengan R acf / statsmodels acf). Index 0 = lag 1. */
export function acf(x: number[], nlags: number): number[] {
  const n = x.length;
  const m = mean(x);
  let c0 = 0;
  for (const v of x) c0 += (v - m) ** 2;
  const out: number[] = [];
  for (let k = 1; k <= nlags; k++) {
    let s = 0;
    for (let t = k; t < n; t++) s += (x[t] - m) * (x[t - k] - m);
    out.push(c0 === 0 ? 0 : s / c0);
  }
  return out;
}

/**
 * Rekursi Durbin-Levinson: dari ρ_1..ρ_K → PACF φ_kk dan koefisien AR(K)
 * Yule-Walker. r[k-1] = ρ_k.
 */
export function durbinLevinson(r: number[]): { pacf: number[]; phi: number[] } {
  const pacfOut: number[] = [];
  let phi: number[] = [];
  for (let k = 1; k <= r.length; k++) {
    let num = r[k - 1];
    let den = 1;
    for (let j = 1; j < k; j++) {
      num -= phi[j - 1] * r[k - j - 1];
      den -= phi[j - 1] * r[j - 1];
    }
    const pkk = Math.abs(den) < 1e-12 ? 0 : num / den;
    const next = new Array<number>(k);
    next[k - 1] = pkk;
    for (let j = 1; j < k; j++) next[j - 1] = phi[j - 1] - pkk * phi[k - j - 1];
    phi = next;
    pacfOut.push(pkk);
  }
  return { pacf: pacfOut, phi };
}

/** PACF sampel lewat Durbin-Levinson pada ACF (sama dengan R pacf / statsmodels method="ldb"). */
export function pacf(x: number[], nlags: number): number[] {
  return durbinLevinson(acf(x, nlags)).pacf;
}

// ============================================================
// UJI KPSS (stasioneritas level / tren)
// ============================================================

/** Nilai kritis KPSS (Kwiatkowski dkk. 1992, Tabel 1): η_μ (level) dan η_τ (tren). */
export const KPSS_CRITICAL = {
  level: [
    { p: 0.1, c: 0.347 },
    { p: 0.05, c: 0.463 },
    { p: 0.025, c: 0.574 },
    { p: 0.01, c: 0.739 },
  ],
  trend: [
    { p: 0.1, c: 0.119 },
    { p: 0.05, c: 0.146 },
    { p: 0.025, c: 0.176 },
    { p: 0.01, c: 0.216 },
  ],
} as const;

export type KpssResult = { stat: number; pValue: number; lags: number };

/** Garis tren OLS a + b·t untuk t = 0..n−1. */
export function linearTrend(x: number[]): { intercept: number; slope: number } {
  const n = x.length;
  const tm = (n - 1) / 2;
  const xm = mean(x);
  let sxy = 0;
  let sxx = 0;
  for (let t = 0; t < n; t++) {
    sxy += (t - tm) * (x[t] - xm);
    sxx += (t - tm) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { intercept: xm - slope * tm, slope };
}

/**
 * KPSS: H0 = deret stasioner di sekitar rata-rata ("level") atau di sekitar
 * tren linear ("trend"). Lag Newey-West "short" = ⌊4(n/100)^¼⌋ seperti
 * tseries/urca (dipakai auto.arima). p-value diinterpolasi dari tabel,
 * dipotong ke [0,01; 0,10].
 */
export function kpssTest(x: number[], type: "level" | "trend" = "level"): KpssResult {
  const n = x.length;
  let e: number[];
  if (type === "trend") {
    const { intercept, slope } = linearTrend(x);
    e = x.map((v, t) => v - intercept - slope * t);
  } else {
    const m = mean(x);
    e = x.map((v) => v - m);
  }
  let cum = 0;
  let eta = 0;
  for (const v of e) {
    cum += v;
    eta += cum * cum;
  }
  eta /= n * n;
  const lags = Math.trunc(4 * Math.pow(n / 100, 0.25));
  let s2 = 0;
  for (const v of e) s2 += v * v;
  for (let l = 1; l <= lags; l++) {
    let g = 0;
    for (let t = l; t < n; t++) g += e[t] * e[t - l];
    s2 += 2 * (1 - l / (lags + 1)) * g;
  }
  s2 /= n;
  const stat = s2 > 1e-300 ? eta / s2 : 0;

  let pValue: number;
  const crit = KPSS_CRITICAL[type];
  if (stat <= crit[0].c) pValue = crit[0].p;
  else if (stat >= crit[crit.length - 1].c) pValue = crit[crit.length - 1].p;
  else {
    let i = 0;
    while (stat > crit[i + 1].c) i++;
    const f = (stat - crit[i].c) / (crit[i + 1].c - crit[i].c);
    pValue = crit[i].p + f * (crit[i + 1].p - crit[i].p);
  }
  return { stat, pValue, lags };
}

export type DifferencingStep = {
  d: number;
  /** "level": stasioner di sekitar rata-rata; "trend": di sekitar tren linear. */
  test: "level" | "trend";
  /** Orde difference musiman yang sudah diterapkan sebelum uji ini (0 kalau tidak ada). */
  D?: number;
  stat: number;
  pValue: number;
  stationary: boolean;
};

export type Differencing = {
  d: number;
  /** Orde difference musiman (0 atau 1). */
  D: number;
  /** Periode musiman yang dipertimbangkan (null = tidak ada). */
  s: number | null;
  /** Kekuatan musiman F_s deret asli (null = tidak dihitung). */
  seasonalStrength: number | null;
  /** true = tren deterministik (trend-stationary): dimodelkan a + b·t + ARMA, tanpa differencing. */
  trend: boolean;
  steps: DifferencingStep[];
};

/**
 * Tentukan differencing:
 *   0. Musiman: F_s > 0,64 → difference musiman D = 1 (butuh ≥ 3 musim).
 *   Lalu bedakan tren STOKASTIK (unit root → difference) dari tren
 *   DETERMINISTIK (stasioner di sekitar garis → cukup detrend), α = 5%:
 *   1. KPSS level tidak menolak → d = 0.
 *   2. Ditolak, tapi KPSS tren tidak menolak (dan D = 0) → tren deterministik, d = 0.
 *      (Men-difference deret seperti ini = over-differencing: muncul MA ≈ −1.)
 *   3. Selain itu difference, ulangi uji level; d + D ≤ maxD.
 */
export function chooseDifferencing(y: number[], maxD = 2, s: number | null = null): Differencing {
  let D = 0;
  let strength: number | null = null;
  const season = s && s >= 2 && y.length >= 3 * s ? s : null;
  if (season) {
    strength = seasonalStrength(y, season);
    if (strength !== null && strength > SEASONAL_STRENGTH_THRESHOLD) D = 1;
  }
  const base = D ? seasonalDifference(y, season!, 1) : y;
  const out = (d: number, trend: boolean, steps: DifferencingStep[]): Differencing => ({
    d,
    D,
    s: season,
    seasonalStrength: strength,
    trend,
    steps,
  });
  const steps: DifferencingStep[] = [];
  const maxd = Math.max(0, maxD - D);
  for (let d = 0; d <= maxd; d++) {
    const w = difference(base, d);
    if (w.length < 8) return out(Math.max(0, d - 1), false, steps);
    if (sd(w) < 1e-12) {
      steps.push({ d, D, test: "level", stat: 0, pValue: 0.1, stationary: true });
      return out(d, false, steps);
    }
    const t = kpssTest(w, "level");
    const stationary = t.stat <= KPSS_CRITICAL.level[1].c;
    steps.push({ d, D, test: "level", stat: t.stat, pValue: t.pValue, stationary });
    if (stationary) return out(d, false, steps);
    if (d === 0 && D === 0) {
      const tt = kpssTest(w, "trend");
      const trendStationary = tt.stat <= KPSS_CRITICAL.trend[1].c;
      steps.push({ d, D, test: "trend", stat: tt.stat, pValue: tt.pValue, stationary: trendStationary });
      if (trendStationary) return out(0, true, steps);
    }
  }
  return out(maxd, false, steps);
}

// ============================================================
// OPTIMASI — Nelder-Mead
// ============================================================

export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  opts: { maxIter?: number; tol?: number; step?: number } = {},
): { x: number[]; fx: number; iterations: number } {
  const n = x0.length;
  const maxIter = opts.maxIter ?? 400 * Math.max(1, n);
  const tol = opts.tol ?? 1e-10;
  const step = opts.step ?? 0.25;
  const safeF = (x: number[]) => {
    const v = f(x);
    return Number.isFinite(v) ? v : Number.MAX_VALUE;
  };

  let simplex: { x: number[]; fx: number }[] = [{ x: x0.slice(), fx: safeF(x0) }];
  for (let i = 0; i < n; i++) {
    const x = x0.slice();
    x[i] += x[i] === 0 ? step : step * Math.max(1, Math.abs(x[i]));
    simplex.push({ x, fx: safeF(x) });
  }

  let it = 0;
  for (; it < maxIter; it++) {
    simplex.sort((a, b) => a.fx - b.fx);
    const best = simplex[0];
    const worst = simplex[n];
    if (Math.abs(worst.fx - best.fx) <= tol * (Math.abs(best.fx) + tol)) {
      let size = 0;
      for (const s of simplex) for (let j = 0; j < n; j++) size = Math.max(size, Math.abs(s.x[j] - best.x[j]));
      if (size < 1e-8) break;
    }
    const centroid = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j] / n;
    const along = (t: number) => centroid.map((c, j) => c + t * (worst.x[j] - c));

    const xr = along(-1);
    const fr = safeF(xr);
    if (fr < best.fx) {
      const xe = along(-2);
      const fe = safeF(xe);
      simplex[n] = fe < fr ? { x: xe, fx: fe } : { x: xr, fx: fr };
    } else if (fr < simplex[n - 1].fx) {
      simplex[n] = { x: xr, fx: fr };
    } else {
      const outside = fr < worst.fx;
      const xc = along(outside ? -0.5 : 0.5);
      const fc = safeF(xc);
      if (fc < (outside ? fr : worst.fx)) {
        simplex[n] = { x: xc, fx: fc };
      } else {
        // shrink ke titik terbaik
        simplex = simplex.map((s, i) => {
          if (i === 0) return s;
          const x = s.x.map((v, j) => best.x[j] + 0.5 * (v - best.x[j]));
          return { x, fx: safeF(x) };
        });
      }
    }
  }
  simplex.sort((a, b) => a.fx - b.fx);
  return { x: simplex[0].x, fx: simplex[0].fx, iterations: it };
}

// ============================================================
// TRANSFORMASI PARAMETER (Jones 1980)
// ============================================================

/** u ∈ ℝ^k → koefisien AR(k) yang dijamin stasioner (tanh → PACF → Durbin-Levinson). */
export function toStationary(u: number[]): number[] {
  // tanh(u) = ±1 persis untuk |u| ≳ 19 (presisi double) → akar unit; jepit sedikit di dalam.
  const r = u.map((v) => Math.max(-0.99999, Math.min(0.99999, Math.tanh(v))));
  let phi: number[] = [];
  for (let k = 0; k < r.length; k++) {
    const next = new Array<number>(k + 1);
    next[k] = r[k];
    for (let j = 0; j < k; j++) next[j] = phi[j] - r[k] * phi[k - 1 - j];
    phi = next;
  }
  return phi;
}

/** Kebalikan toStationary (untuk nilai awal). Koefisien harus stasioner. */
export function fromStationary(phi: number[]): number[] {
  let cur = phi.slice();
  const r = new Array<number>(phi.length);
  for (let k = phi.length - 1; k >= 0; k--) {
    const rk = Math.max(-0.995, Math.min(0.995, cur[k]));
    r[k] = rk;
    const prev = new Array<number>(k);
    for (let j = 0; j < k; j++) prev[j] = (cur[j] + rk * cur[k - 1 - j]) / (1 - rk * rk);
    cur = prev;
  }
  return r.map((v) => Math.atanh(v));
}

/** Apakah koefisien AR(k) stasioner (semua PACF hasil Durbin-Levinson terbalik |r| < 1)? */
export function isStationary(phi: number[]): boolean {
  let cur = phi.slice();
  for (let k = phi.length - 1; k >= 0; k--) {
    const rk = cur[k];
    if (!Number.isFinite(rk) || Math.abs(rk) >= 1) return false;
    const prev = new Array<number>(k);
    for (let j = 0; j < k; j++) prev[j] = (cur[j] + rk * cur[k - 1 - j]) / (1 - rk * rk);
    cur = prev;
  }
  return true;
}

/** Selesaikan Ax = b (eliminasi Gauss dengan pivot parsial). null kalau singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let v = M[r][n];
    for (let k = r + 1; k < n; k++) v -= M[r][k] * x[k];
    x[r] = v / M[r][r];
  }
  return x;
}

/**
 * Nilai awal Hannan-Rissanen untuk ARMA(p,q): (1) AR panjang → taksiran
 * residual ê; (2) OLS w_t pada lag w dan lag ê. Dipakai sebagai salah satu
 * titik awal optimasi (seperti statsmodels).
 */
export function hannanRissanen(w: number[], p: number, q: number): { phi: number[]; theta: number[] } | null {
  const n = w.length;
  const m = Math.min(Math.floor(n / 4), Math.max(2 * (p + q) + 2, Math.floor(Math.log(n) ** 2)));
  if (m < Math.max(p, q) + 1 || n - m - q < 2 * (p + q) + 5) return null;
  const mu = mean(w);
  const z = w.map((v) => v - mu);
  const longAr = durbinLevinson(acf(w, m)).phi;
  const eHat = new Array<number>(n).fill(0);
  for (let t = m; t < n; t++) {
    let pred = 0;
    for (let i = 0; i < m; i++) pred += longAr[i] * z[t - 1 - i];
    eHat[t] = z[t] - pred;
  }
  const k = p + q;
  const XtX = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const Xty = new Array<number>(k).fill(0);
  for (let t = m + q; t < n; t++) {
    const row = [...Array.from({ length: p }, (_, i) => z[t - 1 - i]), ...Array.from({ length: q }, (_, j) => eHat[t - 1 - j])];
    for (let a = 0; a < k; a++) {
      Xty[a] += row[a] * z[t];
      for (let b = 0; b < k; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  const beta = solveLinear(XtX, Xty);
  if (!beta) return null;
  const phi = beta.slice(0, p);
  const theta = beta.slice(p);
  if (!isStationary(phi) || !isStationary(theta.map((v) => -v))) return null;
  return { phi, theta };
}

// ============================================================
// ESTIMASI — CSS
// ============================================================

export type ArimaOrder = {
  p: number;
  d: number;
  q: number;
  constant: boolean;
  /** Tren deterministik: y_t = a + b·t + N_t, N_t ~ ARMA(p,q). Hanya dengan d = 0. */
  trend?: boolean;
  /** Bagian musiman (P, D, Q)_s. Tidak diisi / 0 = model non-musiman. */
  P?: number;
  D?: number;
  Q?: number;
  s?: number;
};

/** Apakah order punya komponen musiman? */
export const isSeasonal = (o: Pick<ArimaOrder, "P" | "D" | "Q" | "s">) =>
  !!o.s && o.s > 1 && ((o.P ?? 0) + (o.D ?? 0) + (o.Q ?? 0) > 0);

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

/** 1 + c₁B^s + c₂B^{2s} + … sebagai polinomial padat. */
function seasonalPoly(c: number[], s: number): number[] {
  const out = new Array<number>(c.length * s + 1).fill(0);
  out[0] = 1;
  c.forEach((v, j) => (out[(j + 1) * s] = v));
  return out;
}

/** AR multiplikatif φ(B)Φ(B^s) dalam bentuk y_t = Σ a_k y_{t−k} + …  (panjang p + sP). */
export function expandAr(phi: number[], Phi: number[] = [], s = 0): number[] {
  if (!Phi.length || s < 2) return phi.slice();
  const a = polyMul([1, ...phi.map((v) => -v)], seasonalPoly(Phi.map((v) => -v), s));
  return a.slice(1).map((v) => -v);
}

/** MA multiplikatif θ(B)Θ(B^s) dalam bentuk … + e_t + Σ m_k e_{t−k}  (panjang q + sQ). */
export function expandMa(theta: number[], Theta: number[] = [], s = 0): number[] {
  if (!Theta.length || s < 2) return theta.slice();
  return polyMul([1, ...theta], seasonalPoly(Theta, s)).slice(1);
}

export type ArimaModel = ArimaOrder & {
  phi: number[];
  theta: number[];
  /** Rata-rata (d=0) atau drift (d=1) dari deret yang sudah di-difference; 0 kalau tanpa konstanta. */
  mu: number;
  sigma2: number;
  loglik: number;
  aic: number;
  aicc: number;
  bic: number;
  /** Jumlah parameter termasuk σ². */
  k: number;
  /** Banyak residual yang dipakai (sampel efektif). */
  nEff: number;
  /** Index awal (pada deret w) residual pertama. */
  start: number;
  /** Residual e_t untuk t = start..n_w−1. */
  residuals: number[];
  /** Garis tren OLS (hanya model tren deterministik). */
  trendLine?: { intercept: number; slope: number };
  /** Koefisien AR & MA musiman (Φ, Θ); kosong untuk model non-musiman. */
  Phi: number[];
  Theta: number[];
};

/**
 * Jumlah kuadrat residual CSS — versi cepat untuk fungsi objektif optimizer:
 * hanya lag dengan koefisien ≠ 0 yang diiterasi (polinomial musiman yang
 * diekspansi kebanyakan nol) dan buffer residual dipakai ulang.
 */
export function cssSumSquares(
  w: number[],
  ar: number[],
  ma: number[],
  mu: number,
  start: number,
  buf: Float64Array,
): number {
  const arLag: number[] = [];
  const arVal: number[] = [];
  for (let i = 0; i < ar.length; i++) if (ar[i] !== 0) (arLag.push(i + 1), arVal.push(ar[i]));
  const maLag: number[] = [];
  const maVal: number[] = [];
  for (let j = 0; j < ma.length; j++) if (ma[j] !== 0) (maLag.push(j + 1), maVal.push(ma[j]));
  const n = w.length;
  let ss = 0;
  for (let t = 0; t < start && t < n; t++) buf[t] = 0;
  for (let t = start; t < n; t++) {
    let pred = mu;
    for (let k = 0; k < arLag.length; k++) pred += arVal[k] * (w[t - arLag[k]] - mu);
    for (let k = 0; k < maLag.length; k++) {
      const idx = t - maLag[k];
      if (idx >= 0) pred += maVal[k] * buf[idx];
    }
    const e = w[t] - pred;
    buf[t] = e;
    ss += e * e;
  }
  return ss;
}

/** Residual CSS: e_t = w_t − ŵ_t, dengan e_t = 0 untuk t < start. */
export function cssResiduals(w: number[], phi: number[], theta: number[], mu: number, start: number): number[] {
  const n = w.length;
  const e = new Array<number>(n).fill(0);
  for (let t = start; t < n; t++) {
    let pred = mu;
    for (let i = 0; i < phi.length; i++) pred += phi[i] * (w[t - 1 - i] - mu);
    for (let j = 0; j < theta.length; j++) if (t - 1 - j >= 0) pred += theta[j] * e[t - 1 - j];
    e[t] = w[t] - pred;
  }
  return e.slice(start);
}

/**
 * Estimasi ARIMA dengan CSS. `start` = banyak observasi (pada deret w) yang
 * dijadikan kondisi awal; untuk membandingkan AICc antar orde, pakai start
 * yang sama (= p maksimum kandidat). Return null kalau data terlalu pendek.
 */
export function fitArima(y: number[], order: ArimaOrder, start = order.p): ArimaModel | null {
  const { p, d, q } = order;
  const s = order.s && order.s > 1 ? order.s : 0;
  const P = s ? (order.P ?? 0) : 0;
  const D = s ? (order.D ?? 0) : 0;
  const Q = s ? (order.Q ?? 0) : 0;
  const trend = !!order.trend && d === 0 && D === 0;
  const constant = order.constant && !trend; // intercept sudah ada di garis tren
  // Tren deterministik: estimasi dua tahap — garis OLS dulu, lalu ARMA pada sisaannya.
  const trendLine = trend ? linearTrend(y) : undefined;
  const w = trendLine
    ? y.map((v, t) => v - trendLine.intercept - trendLine.slope * t)
    : differenceAll(y, d, D, s);
  const m = Math.max(start, p + s * P);
  const nEff = w.length - m;
  const nOpt = p + q + P + Q + (constant ? 1 : 0); // parameter yang dioptimasi Nelder-Mead
  const nPar = nOpt + (trend ? 2 : 0);
  if (nEff < nPar + 3) return null;

  const wm = mean(w);
  const scale = sd(w) || 1;

  // Urutan parameter: φ (p), θ (q), Φ (P), Θ (Q), μ.
  const decode = (x: number[]) => {
    const phi = toStationary(x.slice(0, p));
    const theta = toStationary(x.slice(p, p + q)).map((v) => -v);
    const Phi = toStationary(x.slice(p + q, p + q + P));
    const Theta = toStationary(x.slice(p + q + P, p + q + P + Q)).map((v) => -v);
    const mu = constant ? wm + x[p + q + P + Q] * scale : 0;
    return { phi, theta, Phi, Theta, mu };
  };
  const buf = new Float64Array(w.length);
  const ss = (x: number[]) => {
    const { phi, theta, Phi, Theta, mu } = decode(x);
    return cssSumSquares(w, expandAr(phi, Phi, s), expandMa(theta, Theta, s), mu, m, buf);
  };

  let params: number[] = [];
  if (p + q + P + Q === 0) {
    // Tanpa AR/MA: optimum CSS untuk μ = rata-rata sampel efektif (bentuk tertutup).
    if (constant) params = [(mean(w.slice(m)) - wm) / scale];
  } else {
    // Beberapa titik awal — permukaan CSS model campuran ARMA bisa punya
    // minimum lokal. (1) Hannan-Rissanen, (2) Yule-Walker AR + MA = 0, (3) nol.
    // Bagian musiman diawali dari ACF lag s (AR) / 0 (MA).
    const c0 = constant ? [0] : [];
    const r_s = s && w.length > s + 2 ? Math.max(-0.9, Math.min(0.9, acf(w, s)[s - 1])) : 0;
    const seasonal0 = [...(P ? fromStationary([r_s, ...new Array<number>(P - 1).fill(0)]) : []), ...new Array<number>(Q).fill(0)];
    const starts: number[][] = [];
    const hr = hannanRissanen(w, p, q);
    if (hr) starts.push([...fromStationary(hr.phi), ...fromStationary(hr.theta.map((v) => -v)), ...seasonal0, ...c0]);
    if (p > 0) {
      const yw = durbinLevinson(acf(w, p)).phi;
      if (isStationary(yw)) starts.push([...fromStationary(yw), ...new Array<number>(q).fill(0), ...seasonal0, ...c0]);
    }
    if (P + Q > 0) starts.push([...new Array<number>(p + q).fill(0), ...seasonal0, ...c0]);
    starts.push(new Array<number>(nOpt).fill(0));

    let res = { x: starts[0], fx: Infinity, iterations: 0 };
    for (const x0 of starts) {
      const r = nelderMead(ss, x0);
      if (r.fx < res.fx) res = r;
    }
    // Restart dari titik terbaik — Nelder-Mead bisa berhenti terlalu dini.
    for (let r = 0; r < 3; r++) {
      const again = nelderMead(ss, res.x, { step: 0.1 });
      const improved = again.fx < res.fx - 1e-10 * Math.max(1, Math.abs(res.fx));
      if (again.fx <= res.fx) res = again;
      if (!improved) break;
    }
    params = res.x;
  }

  const { phi, theta, Phi, Theta, mu } = decode(params);
  const residuals = cssResiduals(w, expandAr(phi, Phi, s), expandMa(theta, Theta, s), mu, m);
  let sse = 0;
  for (const e of residuals) sse += e * e;
  const sigma2 = sse / nEff;
  const loglik = sigma2 > 0 ? -0.5 * nEff * (Math.log(2 * Math.PI * sigma2) + 1) : Infinity;
  const k = nPar + 1;
  const aic = -2 * loglik + 2 * k;
  const aicc = nEff - k - 1 > 0 ? aic + (2 * k * (k + 1)) / (nEff - k - 1) : Infinity;
  const bic = -2 * loglik + k * Math.log(nEff);
  return {
    ...order,
    ...(s ? { P, D, Q, s } : { P: undefined, D: undefined, Q: undefined, s: undefined }),
    constant,
    trend,
    phi,
    theta,
    Phi,
    Theta,
    mu,
    sigma2,
    loglik,
    aic,
    aicc,
    bic,
    k,
    nEff,
    start: m,
    residuals,
    ...(trendLine ? { trendLine } : {}),
  };
}

// ============================================================
// PERAMALAN
// ============================================================

/**
 * Koefisien AR model penuh φ*(B) = φ(B)(1−B)^d(1−B^s)^D, dalam bentuk
 * y_t = Σ φ*_i y_{t−i} + …  (phi boleh berupa AR multiplikatif yang sudah diekspansi).
 */
export function integratedAr(phi: number[], d: number, D = 0, s = 0): number[] {
  let a = [1, ...phi.map((v) => -v)];
  for (let k = 0; k < d; k++) a = polyMul(a, [1, -1]);
  if (s > 1) for (let k = 0; k < D; k++) a = polyMul(a, seasonalPoly([-1], s));
  return a.slice(1).map((v) => -v);
}

/** Bobot ψ_0..ψ_{h−1} representasi MA(∞) model penuh (phi/theta = bentuk terekspansi). */
export function psiWeights(phi: number[], theta: number[], d: number, h: number, D = 0, s = 0): number[] {
  const ar = integratedAr(phi, d, D, s);
  const psi = [1];
  for (let j = 1; j < h; j++) {
    let v = j <= theta.length ? theta[j - 1] : 0;
    for (let i = 1; i <= Math.min(j, ar.length); i++) v += ar[i - 1] * psi[j - i];
    psi.push(v);
  }
  return psi;
}

export type ArimaForecast = { mean: number[]; lower: number[]; upper: number[]; se: number[] };

/** z_{0,975}: interval 95%. */
export const Z95 = 1.959963984540054;

export function forecastArima(y: number[], model: ArimaModel, h: number, z = Z95): ArimaForecast {
  const { d, mu, trendLine } = model;
  const s = model.s && model.s > 1 ? model.s : 0;
  const D = s ? (model.D ?? 0) : 0;
  const ar = expandAr(model.phi, model.Phi ?? [], s);
  const ma = expandMa(model.theta, model.Theta ?? [], s);
  const line = (t: number) => (trendLine ? trendLine.intercept + trendLine.slope * t : 0);
  const w = trendLine ? y.map((v, t) => v - line(t)) : differenceAll(y, d, D, s);
  const n = w.length;
  const e = new Array<number>(n).fill(0);
  model.residuals.forEach((v, i) => (e[model.start + i] = v));

  const wExt = w.slice();
  for (let k = 0; k < h; k++) {
    const t = n + k;
    let pred = mu;
    for (let i = 0; i < ar.length; i++) pred += ar[i] * (wExt[t - 1 - i] - mu);
    for (let j = 0; j < ma.length; j++) if (t - 1 - j < n) pred += ma[j] * e[t - 1 - j];
    wExt.push(pred);
  }

  // Integrasi balik, operator demi operator (urutan kebalikan dari differenceAll):
  // tingkat k di masa depan = tingkat k+1 + nilai tingkat k "lag" periode sebelumnya
  // (lag 1 untuk difference biasa, lag s untuk difference musiman).
  let f = wExt.slice(n);
  if (!trendLine) {
    const lags = [...new Array<number>(D).fill(s), ...new Array<number>(d).fill(1)];
    const levels = [y];
    for (const lag of lags) {
      const prev = levels[levels.length - 1];
      levels.push(lag === 1 ? difference(prev, 1) : seasonalDifference(prev, lag, 1));
    }
    for (let k = lags.length - 1; k >= 0; k--) {
      const base = levels[k];
      const lag = lags[k];
      const up = f;
      const out: number[] = [];
      for (let j = 0; j < up.length; j++) {
        const idx = base.length + j - lag;
        out.push(up[j] + (idx < base.length ? base[idx] : out[idx - base.length]));
      }
      f = out;
    }
  } else {
    f = f.map((v, i) => v + line(y.length + i));
  }

  const psi = psiWeights(ar, ma, trendLine ? 0 : d, h, trendLine ? 0 : D, s);
  // Model tren: tambahkan ketidakpastian garis OLS di t* — s²(1/n + (t*−t̄)²/Sxx).
  let lineVar = (_t: number) => 0;
  if (trendLine) {
    const ny = y.length;
    const tm = (ny - 1) / 2;
    let sxx = 0;
    let ss = 0;
    for (let t = 0; t < ny; t++) {
      sxx += (t - tm) ** 2;
      ss += w[t] * w[t];
    }
    const s2 = ss / Math.max(1, ny - 2);
    lineVar = (t) => s2 * (1 / ny + (t - tm) ** 2 / sxx);
  }
  const se: number[] = [];
  let acc = 0;
  for (let i = 0; i < h; i++) {
    acc += psi[i] * psi[i];
    se.push(Math.sqrt(model.sigma2 * acc + lineVar(y.length + i)));
  }
  return {
    mean: f,
    lower: f.map((v, i) => v - z * se[i]),
    upper: f.map((v, i) => v + z * se[i]),
    se,
  };
}

// ============================================================
// DIAGNOSTIK — Ljung-Box
// ============================================================

export type LjungBox = { q: number; df: number; lags: number; pValue: number };

/** Q = n(n+2) Σ r_k²/(n−k), ~ χ²(lags − fitdf) di bawah H0 residual white noise. */
export function ljungBox(res: number[], lags: number, fitdf = 0): LjungBox | null {
  const n = res.length;
  const df = lags - fitdf;
  if (lags < 1 || lags >= n || df < 1) return null;
  const r = acf(res, lags);
  let q = 0;
  for (let k = 1; k <= lags; k++) q += (r[k - 1] * r[k - 1]) / (n - k);
  q *= n * (n + 2);
  return { q, df, lags, pValue: chiSquareSurvival(q, df) };
}

// ============================================================
// AKAR POLINOMIAL — cek kestasioneran / invertibilitas
// ============================================================

/**
 * Modulus akar terkecil dari 1 + c₁z + … + c_k z^k (Durand-Kerner).
 * AR: c = −φ; MA: c = θ. Infinity kalau polinomialnya konstan.
 */
export function minRootModulus(c: number[]): number {
  const coefs = c.slice();
  while (coefs.length && Math.abs(coefs[coefs.length - 1]) < 1e-10) coefs.pop();
  const k = coefs.length;
  if (k === 0) return Infinity;
  if (k === 1) return 1 / Math.abs(coefs[0]);
  // Monik: z^k + a_{k-1} z^{k-1} + … + a_0, dengan a_j = c_j / c_k (c_0 = 1).
  const lead = coefs[k - 1];
  const a = [1, ...coefs].map((v) => v / lead); // a[j] = koef z^j
  type C = [number, number];
  const mul = (x: C, y: C): C => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const div = (x: C, y: C): C => {
    const d = y[0] * y[0] + y[1] * y[1] || 1e-300;
    return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d];
  };
  const evalP = (z: C): C => {
    let r: C = [1, 0]; // koef z^k = 1
    for (let j = k - 1; j >= 0; j--) r = [mul(r, z)[0] + a[j], mul(r, z)[1]];
    return r;
  };
  // Tebakan awal standar Durand-Kerner: pangkat dari (0,4 + 0,9i).
  let roots: C[] = Array.from({ length: k }, (_, i) => {
    const p: C = [0.4, 0.9];
    let z: C = [1, 0];
    for (let t = 0; t <= i; t++) z = mul(z, p);
    return z;
  });
  for (let it = 0; it < 500; it++) {
    let delta = 0;
    roots = roots.map((zi, i) => {
      let den: C = [1, 0];
      roots.forEach((zj, j) => {
        if (j !== i) den = mul(den, [zi[0] - zj[0], zi[1] - zj[1]]);
      });
      const step = div(evalP(zi), den);
      delta = Math.max(delta, Math.hypot(step[0], step[1]));
      return [zi[0] - step[0], zi[1] - step[1]];
    });
    if (delta < 1e-12) break;
  }
  return Math.min(...roots.map((z) => Math.hypot(z[0], z[1])));
}

/** Batas auto.arima: akar dengan |z| < 1,01 dianggap terlalu dekat lingkaran satuan. */
export const MIN_ROOT_MODULUS = 1.01;

/**
 * Cek akar polinomial AR & MA model penuh. Akar Φ(B^s) = akar pangkat-s dari
 * akar Φ(z), jadi modulusnya |r|^{1/s} — lebih dekat ke 1 daripada akar Φ sendiri
 * (sama dengan memeriksa polinomial terekspansi seperti auto.arima).
 */
export function rootsOk(
  m: Pick<ArimaModel, "phi" | "theta"> & Partial<Pick<ArimaModel, "Phi" | "Theta" | "s">>,
): { ar: boolean; ma: boolean } {
  const s = m.s && m.s > 1 ? m.s : 1;
  const seasonalMin = (c: number[]) => (c.length ? Math.pow(minRootModulus(c), 1 / s) : Infinity);
  return {
    ar: Math.min(minRootModulus(m.phi.map((v) => -v)), seasonalMin((m.Phi ?? []).map((v) => -v))) >= MIN_ROOT_MODULUS,
    ma: Math.min(minRootModulus(m.theta), seasonalMin(m.Theta ?? [])) >= MIN_ROOT_MODULUS,
  };
}

// ============================================================
// AUTO ARIMA (grid kecil)
// ============================================================

export const ARIMA_LIMITS = {
  maxP: 3,
  maxQ: 3,
  /** p + q maksimum — model sederhana lebih stabil untuk deret pendek. */
  maxPQ: 4,
  maxD: 2,
  /** Saat bagian musiman ikut dicari, p & q dibatasi 2 supaya grid tetap cepat di browser. */
  maxPQSeasonal: 2,
  /** P & Q musiman maksimum. */
  maxSeasonalOrder: 1,
  /** Periode musiman terpanjang yang dimodelkan (52 minggu terlalu panjang untuk CSS). */
  maxSeasonalPeriod: 24,
};

type CandidateOrder = Pick<ArimaOrder, "p" | "d" | "q" | "constant" | "trend" | "P" | "D" | "Q" | "s">;

export type AutoArimaResult = {
  model: ArimaModel;
  differencing: Differencing;
  /** Kandidat yang lolos cek akar, urut AICc naik. */
  candidates: (CandidateOrder & { aicc: number })[];
  /**
   * Kandidat yang ditolak karena akar AR/MA terlalu dekat lingkaran satuan.
   * `overDifferenced` = akar MA tepat di z = 1 (θ(1) ≈ 0 atau Θ(1) ≈ 0) setelah
   * differencing: faktor MA "membatalkan" (1 − B) / (1 − B^s) — gejala klasik
   * over-differencing.
   */
  rejected: (CandidateOrder & { aicc: number; reason: "ar" | "ma"; overDifferenced: boolean })[];
};

/**
 * Auto ARIMA / SARIMA. `s` = periode musiman kandidat (12 bulanan, 4 kuartalan,
 * 7 harian, 5 hari kerja). Bagian musiman (P, Q ≤ 1) hanya dicari kalau ada
 * bukti musiman: difference musiman dipakai (F_s > 0,64) atau ACF deret
 * stasioner di lag s signifikan.
 */
export function autoArima(
  y: number[],
  opts: { maxP?: number; maxQ?: number; s?: number | null } = {},
): AutoArimaResult | null {
  const sCand = opts.s && opts.s >= 2 && opts.s <= ARIMA_LIMITS.maxSeasonalPeriod ? opts.s : null;
  const differencing = chooseDifferencing(y, ARIMA_LIMITS.maxD, sCand);
  const { d, D, trend } = differencing;
  const s = differencing.s ?? 0;
  const tl = trend ? linearTrend(y) : null;
  const w = tl ? y.map((v, t) => v - tl.intercept - tl.slope * t) : differenceAll(y, d, D, s);
  const seasonalSearch =
    s > 0 && (D > 0 || (w.length > s + 2 && Math.abs(acf(w, s)[s - 1]) > 1.96 / Math.sqrt(w.length)));
  const maxPs = seasonalSearch ? ARIMA_LIMITS.maxSeasonalOrder : 0;

  const nW = y.length - d - D * s;
  // Deret pendek → batasi orde supaya parameter tidak lebih banyak dari data.
  const cap = Math.max(1, Math.min(seasonalSearch ? ARIMA_LIMITS.maxPQSeasonal : ARIMA_LIMITS.maxP, Math.floor(nW / 10)));
  const maxP = Math.min(opts.maxP ?? ARIMA_LIMITS.maxP, cap);
  const maxQ = Math.min(opts.maxQ ?? ARIMA_LIMITS.maxQ, cap);
  // Konstanta: rata-rata kalau d + D = 0, drift opsional kalau d + D = 1, tidak ada kalau 2.
  // Tren deterministik: intercept & slope sudah di garis tren → tanpa konstanta tambahan.
  const constants = trend ? [false] : d + D === 0 ? [true] : d + D === 1 ? [true, false] : [false];
  // Kondisi awal sama untuk semua kandidat supaya AICc sebanding.
  const start = maxP + s * maxPs;

  const fitted: ArimaModel[] = [];
  const rejected: AutoArimaResult["rejected"] = [];
  type Spec = { p: number; q: number; P: number; Q: number; constant: boolean };
  const seen = new Map<string, ArimaModel | null>(); // null = gagal / ditolak
  const tryFit = (sp: Spec): ArimaModel | null => {
    const key = `${sp.p},${sp.q},${sp.P},${sp.Q},${sp.constant}`;
    if (seen.has(key)) return seen.get(key)!;
    let accepted: ArimaModel | null = null;
    const inRange =
      sp.p >= 0 && sp.q >= 0 && sp.p <= maxP && sp.q <= maxQ && sp.p + sp.q <= ARIMA_LIMITS.maxPQ &&
      sp.P >= 0 && sp.Q >= 0 && sp.P <= maxPs && sp.Q <= maxPs && constants.includes(sp.constant);
    if (inRange) {
      const seasonal = s > 0 && sp.P + sp.Q + D > 0;
      const order: ArimaOrder = seasonal
        ? { p: sp.p, d, q: sp.q, constant: sp.constant, trend, P: sp.P, D, Q: sp.Q, s }
        : { p: sp.p, d, q: sp.q, constant: sp.constant, trend };
      const m = fitArima(y, order, start);
      if (m && Number.isFinite(m.aicc)) {
        // Seperti auto.arima: tolak model dengan akar |z| < 1,01 — estimasi di
        // batas (AR hampir unit root / MA hampir tidak invertibel) tidak stabil
        // dan sering berupa akar AR & MA yang saling meniadakan.
        const ok = rootsOk(m);
        if (ok.ar && ok.ma) {
          fitted.push(m);
          accepted = m;
        } else {
          const theta1 = 1 + m.theta.reduce((a, v) => a + v, 0);
          const Theta1 = 1 + m.Theta.reduce((a, v) => a + v, 0);
          rejected.push({
            ...pickOrder(m),
            aicc: m.aicc,
            reason: ok.ar ? "ma" : "ar",
            overDifferenced:
              !ok.ma &&
              ((d >= 1 && m.theta.length > 0 && Math.abs(theta1) < 0.05) ||
                (D >= 1 && m.Theta.length > 0 && Math.abs(Theta1) < 0.05)),
          });
        }
      }
    }
    seen.set(key, accepted);
    return accepted;
  };

  if (!seasonalSearch) {
    // Non-musiman: grid lengkap (paling banyak 14 orde × 2 konstanta — murah).
    for (let p = 0; p <= maxP; p++)
      for (let q = 0; q <= maxQ; q++) for (const constant of constants) tryFit({ p, q, P: 0, Q: 0, constant });
  } else {
    // Musiman: pencarian stepwise Hyndman-Khandakar (seperti auto.arima) —
    // grid lengkap SARIMA terlalu lambat untuk dijalankan di browser.
    const c0 = constants[0];
    const initial: Spec[] = [
      { p: Math.min(2, maxP), q: Math.min(2, maxQ), P: maxPs, Q: maxPs, constant: c0 },
      { p: 0, q: 0, P: 0, Q: 0, constant: c0 },
      { p: Math.min(1, maxP), q: 0, P: maxPs, Q: 0, constant: c0 },
      { p: 0, q: Math.min(1, maxQ), P: 0, Q: maxPs, constant: c0 },
    ];
    let best: { spec: Spec; aicc: number } | null = null;
    for (const sp of initial) {
      const m = tryFit(sp);
      if (m && (!best || m.aicc < best.aicc)) best = { spec: sp, aicc: m.aicc };
    }
    for (let step = 0; best && step < 50; step++) {
      const b = best.spec;
      const neighbours: Spec[] = [];
      for (const dp of [-1, 1]) {
        neighbours.push({ ...b, p: b.p + dp }, { ...b, q: b.q + dp }, { ...b, P: b.P + dp }, { ...b, Q: b.Q + dp });
        neighbours.push({ ...b, p: b.p + dp, q: b.q + dp }, { ...b, P: b.P + dp, Q: b.Q + dp });
      }
      for (const c of constants) if (c !== b.constant) neighbours.push({ ...b, constant: c });
      let improved = false;
      for (const sp of neighbours) {
        const m = tryFit(sp);
        if (m && m.aicc < best.aicc - 1e-9) {
          best = { spec: sp, aicc: m.aicc };
          improved = true;
        }
      }
      if (!improved) break;
    }
  }
  if (fitted.length === 0) return null;
  // AICc terkecil; seri → pilih model dengan parameter lebih sedikit.
  fitted.sort((a, b) => a.aicc - b.aicc || a.k - b.k);
  return {
    model: fitted[0],
    differencing,
    candidates: fitted.map((m) => ({ ...pickOrder(m), aicc: m.aicc })),
    rejected,
  };
}

function pickOrder(m: ArimaModel): CandidateOrder {
  const { p, d, q, constant, trend, P, D, Q, s } = m;
  return isSeasonal(m) ? { p, d, q, constant, trend, P, D, Q, s } : { p, d, q, constant, trend };
}

/** "ARIMA(1,1,0) dengan drift", "SARIMA(1,0,0)(0,1,1)[12] dengan drift" */
export function arimaLabel(o: ArimaOrder): string {
  const seasonal = isSeasonal(o);
  const base = seasonal
    ? `SARIMA(${o.p},${o.d},${o.q})(${o.P ?? 0},${o.D ?? 0},${o.Q ?? 0})[${o.s}]`
    : `ARIMA(${o.p},${o.d},${o.q})`;
  if (o.trend) return `${base} + tren linear`;
  if (!o.constant) return base;
  const diffs = o.d + (seasonal ? (o.D ?? 0) : 0);
  return diffs === 0 ? `${base} dengan rata-rata` : `${base} dengan drift`;
}
