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
  stat: number;
  pValue: number;
  stationary: boolean;
};

export type Differencing = {
  d: number;
  /** true = tren deterministik (trend-stationary): dimodelkan a + b·t + ARMA, tanpa differencing. */
  trend: boolean;
  steps: DifferencingStep[];
};

/**
 * Bedakan tren STOKASTIK (unit root → difference) dari tren DETERMINISTIK
 * (stasioner di sekitar garis → cukup detrend), α = 5%:
 *   1. KPSS level pada deret asli tidak menolak → d = 0.
 *   2. Ditolak, tapi KPSS tren tidak menolak → tren deterministik, d = 0.
 *      (Men-difference deret seperti ini = over-differencing: muncul MA ≈ −1.)
 *   3. Selain itu difference, ulangi uji level, maks maxD.
 */
export function chooseDifferencing(y: number[], maxD = 2): Differencing {
  const steps: DifferencingStep[] = [];
  for (let d = 0; d <= maxD; d++) {
    const w = difference(y, d);
    if (w.length < 8) return { d: Math.max(0, d - 1), trend: false, steps };
    if (sd(w) < 1e-12) {
      steps.push({ d, test: "level", stat: 0, pValue: 0.1, stationary: true });
      return { d, trend: false, steps };
    }
    const t = kpssTest(w, "level");
    const stationary = t.stat <= KPSS_CRITICAL.level[1].c;
    steps.push({ d, test: "level", stat: t.stat, pValue: t.pValue, stationary });
    if (stationary) return { d, trend: false, steps };
    if (d === 0) {
      const tt = kpssTest(w, "trend");
      const trendStationary = tt.stat <= KPSS_CRITICAL.trend[1].c;
      steps.push({ d, test: "trend", stat: tt.stat, pValue: tt.pValue, stationary: trendStationary });
      if (trendStationary) return { d: 0, trend: true, steps };
    }
  }
  return { d: maxD, trend: false, steps };
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
};

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
};

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
  const trend = !!order.trend && d === 0;
  const constant = order.constant && !trend; // intercept sudah ada di garis tren
  // Tren deterministik: estimasi dua tahap — garis OLS dulu, lalu ARMA pada sisaannya.
  const trendLine = trend ? linearTrend(y) : undefined;
  const w = trendLine ? y.map((v, t) => v - trendLine.intercept - trendLine.slope * t) : difference(y, d);
  const m = Math.max(start, p);
  const nEff = w.length - m;
  const nOpt = p + q + (constant ? 1 : 0); // parameter yang dioptimasi Nelder-Mead
  const nPar = nOpt + (trend ? 2 : 0);
  if (nEff < nPar + 3) return null;

  const wm = mean(w);
  const scale = sd(w) || 1;

  const decode = (x: number[]) => {
    const phi = toStationary(x.slice(0, p));
    const theta = toStationary(x.slice(p, p + q)).map((v) => -v);
    const mu = constant ? wm + x[p + q] * scale : 0;
    return { phi, theta, mu };
  };
  const ss = (x: number[]) => {
    const { phi, theta, mu } = decode(x);
    let s = 0;
    for (const e of cssResiduals(w, phi, theta, mu, m)) s += e * e;
    return s;
  };

  let params: number[] = [];
  if (p + q === 0) {
    // Tanpa AR/MA: optimum CSS untuk μ = rata-rata sampel efektif (bentuk tertutup).
    if (constant) params = [(mean(w.slice(m)) - wm) / scale];
  } else {
    // Beberapa titik awal — permukaan CSS model campuran ARMA bisa punya
    // minimum lokal. (1) Hannan-Rissanen, (2) Yule-Walker AR + MA = 0, (3) nol.
    const c0 = constant ? [0] : [];
    const starts: number[][] = [];
    const hr = hannanRissanen(w, p, q);
    if (hr) starts.push([...fromStationary(hr.phi), ...fromStationary(hr.theta.map((v) => -v)), ...c0]);
    if (p > 0) {
      const yw = durbinLevinson(acf(w, p)).phi;
      if (isStationary(yw)) starts.push([...fromStationary(yw), ...new Array<number>(q).fill(0), ...c0]);
    }
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

  const { phi, theta, mu } = decode(params);
  const residuals = cssResiduals(w, phi, theta, mu, m);
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
    constant,
    trend,
    phi,
    theta,
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

/** Koefisien AR model penuh φ*(B) = φ(B)(1−B)^d, dalam bentuk y_t = Σ φ*_i y_{t−i} + … */
export function integratedAr(phi: number[], d: number): number[] {
  // Polinomial a(B) = 1 − Σ φ_i B^i, dikali (1 − B) sebanyak d kali.
  let a = [1, ...phi.map((v) => -v)];
  for (let k = 0; k < d; k++) {
    const next = new Array<number>(a.length + 1).fill(0);
    for (let i = 0; i < a.length; i++) {
      next[i] += a[i];
      next[i + 1] -= a[i];
    }
    a = next;
  }
  return a.slice(1).map((v) => -v);
}

/** Bobot ψ_0..ψ_{h−1} representasi MA(∞) model penuh. */
export function psiWeights(phi: number[], theta: number[], d: number, h: number): number[] {
  const ar = integratedAr(phi, d);
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
  const { d, phi, theta, mu, trendLine } = model;
  const line = (t: number) => (trendLine ? trendLine.intercept + trendLine.slope * t : 0);
  const w = trendLine ? y.map((v, t) => v - line(t)) : difference(y, d);
  const n = w.length;
  const e = new Array<number>(n).fill(0);
  model.residuals.forEach((v, i) => (e[model.start + i] = v));

  const wExt = w.slice();
  for (let s = 0; s < h; s++) {
    const t = n + s;
    let pred = mu;
    for (let i = 0; i < phi.length; i++) pred += phi[i] * (wExt[t - 1 - i] - mu);
    for (let j = 0; j < theta.length; j++) if (t - 1 - j < n) pred += theta[j] * e[t - 1 - j];
    wExt.push(pred);
  }

  // Integrasi balik: tiap tingkat differencing dijumlah kumulatif dari nilai terakhirnya.
  let f = wExt.slice(n);
  for (let k = d - 1; k >= 0; k--) {
    const level = difference(y, k);
    let last = level[level.length - 1];
    f = f.map((v) => (last += v));
  }
  if (trendLine) f = f.map((v, i) => v + line(y.length + i));

  const psi = psiWeights(phi, theta, d, h);
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

export function rootsOk(m: Pick<ArimaModel, "phi" | "theta">): { ar: boolean; ma: boolean } {
  return {
    ar: minRootModulus(m.phi.map((v) => -v)) >= MIN_ROOT_MODULUS,
    ma: minRootModulus(m.theta) >= MIN_ROOT_MODULUS,
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
};

export type AutoArimaResult = {
  model: ArimaModel;
  differencing: Differencing;
  /** Kandidat yang lolos cek akar, urut AICc naik. */
  candidates: { p: number; d: number; q: number; constant: boolean; trend?: boolean; aicc: number }[];
  /**
   * Kandidat yang ditolak karena akar AR/MA terlalu dekat lingkaran satuan.
   * `overDifferenced` = akar MA tepat di z = 1 (θ(1) ≈ 0) setelah differencing:
   * faktor MA "membatalkan" (1 − B) — gejala klasik over-differencing.
   */
  rejected: { p: number; d: number; q: number; constant: boolean; aicc: number; reason: "ar" | "ma"; overDifferenced: boolean }[];
};

export function autoArima(y: number[], opts: { maxP?: number; maxQ?: number } = {}): AutoArimaResult | null {
  const differencing = chooseDifferencing(y, ARIMA_LIMITS.maxD);
  const { d } = differencing;
  const nW = y.length - d;
  // Deret pendek → batasi orde supaya parameter tidak lebih banyak dari data.
  const cap = Math.max(1, Math.min(ARIMA_LIMITS.maxP, Math.floor(nW / 10)));
  const maxP = Math.min(opts.maxP ?? ARIMA_LIMITS.maxP, cap);
  const maxQ = Math.min(opts.maxQ ?? ARIMA_LIMITS.maxQ, cap);
  const trend = differencing.trend;
  // Tren deterministik: intercept & slope sudah di garis tren → tanpa konstanta tambahan.
  const constants = trend ? [false] : d === 0 ? [true] : d === 1 ? [true, false] : [false];

  const fitted: ArimaModel[] = [];
  const rejected: AutoArimaResult["rejected"] = [];
  for (let p = 0; p <= maxP; p++) {
    for (let q = 0; q <= maxQ; q++) {
      if (p + q > ARIMA_LIMITS.maxPQ) continue;
      for (const constant of constants) {
        const m = fitArima(y, { p, d, q, constant, trend }, maxP);
        if (!m || !Number.isFinite(m.aicc)) continue;
        // Seperti auto.arima: tolak model dengan akar |z| < 1,01 — estimasi di
        // batas (AR hampir unit root / MA hampir tidak invertibel) tidak stabil
        // dan sering berupa akar AR & MA yang saling meniadakan.
        const ok = rootsOk(m);
        if (ok.ar && ok.ma) fitted.push(m);
        else {
          const theta1 = 1 + m.theta.reduce((a, v) => a + v, 0);
          rejected.push({
            p,
            d,
            q,
            constant,
            aicc: m.aicc,
            reason: ok.ar ? "ma" : "ar",
            overDifferenced: !ok.ma && d >= 1 && Math.abs(theta1) < 0.05,
          });
        }
      }
    }
  }
  if (fitted.length === 0) return null;
  // AICc terkecil; seri → pilih model dengan parameter lebih sedikit.
  fitted.sort((a, b) => a.aicc - b.aicc || a.k - b.k);
  return {
    model: fitted[0],
    differencing,
    candidates: fitted.map(({ p, d: dd, q, constant, trend: tr, aicc }) => ({ p, d: dd, q, constant, trend: tr, aicc })),
    rejected,
  };
}

/** "ARIMA(1,1,0) dengan drift" */
export function arimaLabel(o: ArimaOrder): string {
  const base = `ARIMA(${o.p},${o.d},${o.q})`;
  if (o.trend) return `${base} + tren linear`;
  if (!o.constant) return base;
  return o.d === 0 ? `${base} dengan rata-rata` : `${base} dengan drift`;
}
