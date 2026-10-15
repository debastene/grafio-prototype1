import { describe, expect, it } from "vitest";
import {
  acf,
  arimaLabel,
  autoArima,
  differenceAll,
  expandAr,
  expandMa,
  seasonalDifference,
  seasonalStrength,
  chooseDifferencing,
  cssResiduals,
  difference,
  fitArima,
  forecastArima,
  fromStationary,
  integratedAr,
  kpssTest,
  ljungBox,
  minRootModulus,
  nelderMead,
  pacf,
  psiWeights,
  rootsOk,
  toStationary,
} from "../arima";
import { mulberry32 } from "../multivariate";
import ref from "./fixtures/arima-ref.json";

/** Normal baku deterministik (Box-Muller di atas mulberry32). */
function normals(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}

const close = (a: number[], b: number[], digits: number) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe("ACF, PACF, KPSS, Ljung-Box (acuan numpy/scipy)", () => {
  const x = ref.ar2.data;

  it("ACF sama dengan numpy", () => close(acf(x, 5), ref.ar2.acf, 10));

  it("PACF Durbin-Levinson = solusi sistem Yule-Walker", () => close(pacf(x, 5), ref.ar2.pacf, 10));

  it("statistik KPSS sama, deret AR stasioner tidak ditolak", () => {
    const k = kpssTest(x);
    expect(k.lags).toBe(ref.ar2.kpss.lags);
    expect(k.stat).toBeCloseTo(ref.ar2.kpss.stat, 10);
    expect(k.pValue).toBe(0.1); // stat < 0,347
  });

  it("random walk ditolak stasioner; setelah difference stasioner → d = 1", () => {
    const rw = ref.randomWalk.data;
    expect(kpssTest(rw).stat).toBeCloseTo(ref.randomWalk.kpss.stat, 10);
    expect(kpssTest(rw).pValue).toBe(0.01);
    expect(kpssTest(difference(rw, 1)).stat).toBeCloseTo(ref.randomWalk.kpssDiff.stat, 10);
    expect(chooseDifferencing(rw).d).toBe(1);
    expect(chooseDifferencing(x).d).toBe(0);
  });

  it("p-value KPSS diinterpolasi linear di antara nilai kritis", () => {
    // Deret dengan tren kuat → statistik besar → p dipotong di 0,01.
    expect(kpssTest(Array.from({ length: 60 }, (_, i) => i)).pValue).toBe(0.01);
  });
});

describe("estimasi CSS", () => {
  it("AR(2) dengan konstanta = OLS bersyarat (numpy lstsq)", () => {
    const m = fitArima(ref.ar2.data, { p: 2, d: 0, q: 0, constant: true })!;
    expect(m.phi[0]).toBeCloseTo(ref.ar2.ols.phi1, 5);
    expect(m.phi[1]).toBeCloseTo(ref.ar2.ols.phi2, 5);
    expect(m.mu).toBeCloseTo(ref.ar2.ols.mu, 4);
    expect(m.sigma2).toBeCloseTo(ref.ar2.ols.sigma2, 6);
    expect(m.nEff).toBe(198);
  });

  it("ramalan + standard error AR(2) sama dengan rekursi & bobot ψ analitik", () => {
    const m = fitArima(ref.ar2.data, { p: 2, d: 0, q: 0, constant: true })!;
    const f = forecastArima(ref.ar2.data, m, 3);
    close(f.mean, ref.ar2.forecast, 4);
    close(f.se, ref.ar2.se, 5);
    expect(f.upper[0] - f.mean[0]).toBeCloseTo(1.959964 * f.se[0], 5);
  });

  it("Ljung-Box residual sama dengan rumus + scipy chi2.sf", () => {
    const m = fitArima(ref.ar2.data, { p: 2, d: 0, q: 0, constant: true })!;
    const lb = ljungBox(m.residuals, 10, 2)!;
    expect(lb.df).toBe(8);
    expect(lb.q).toBeCloseTo(ref.ar2.ljungBox.q, 4);
    expect(lb.pValue).toBeCloseTo(ref.ar2.ljungBox.pValue, 5);
  });

  it("MA(1) θ = 0,6 terestimasi mendekati nilai sebenarnya", () => {
    const e = normals(1001, 7);
    const y = Array.from({ length: 1000 }, (_, t) => 5 + e[t + 1] + 0.6 * e[t]);
    const m = fitArima(y, { p: 0, d: 0, q: 1, constant: true })!;
    expect(m.theta[0]).toBeGreaterThan(0.52);
    expect(m.theta[0]).toBeLessThan(0.68);
    expect(m.mu).toBeCloseTo(5, 0);
    // Optimum CSS tidak lebih buruk dari parameter sebenarnya.
    const ssTrue = cssResiduals(y, [], [0.6], 5, 0).reduce((a, v) => a + v * v, 0);
    expect(m.sigma2 * m.nEff).toBeLessThanOrEqual(ssTrue + 1e-9);
  });

  it("transformasi Jones: bolak-balik konsisten & hasilnya stasioner", () => {
    const phi = toStationary([0.8, -1.5, 1.2]);
    close(toStationary(fromStationary(phi)), phi, 10);
    // AR(1): |φ| < 1 untuk input berapa pun
    expect(Math.abs(toStationary([50])[0])).toBeLessThan(1);
  });

  it("Nelder-Mead menemukan minimum Rosenbrock (1, 1)", () => {
    const r = nelderMead((x) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2, [-1.2, 1], { maxIter: 5000 });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
  });
});

describe("peramalan & bobot ψ", () => {
  it("φ*(B) untuk ARIMA(1,1,0) = 1 − (1+φ)B + φB²", () => {
    close(integratedAr([0.5], 1), [1.5, -0.5], 12);
    close(integratedAr([], 2), [2, -1], 12);
  });

  it("ψ_j ARIMA(1,1,0) = Σ φ^i (i = 0..j)", () => {
    close(psiWeights([0.5], [], 1, 4), [1, 1.5, 1.75, 1.875], 12);
  });

  it("random walk: ramalan = nilai terakhir, se = σ√h", () => {
    const e = normals(300, 11);
    let acc = 50;
    const y = e.map((v) => (acc += v));
    const m = fitArima(y, { p: 0, d: 1, q: 0, constant: false })!;
    const f = forecastArima(y, m, 4);
    f.mean.forEach((v) => expect(v).toBeCloseTo(y[y.length - 1], 10));
    f.se.forEach((s, i) => expect(s).toBeCloseTo(Math.sqrt(m.sigma2 * (i + 1)), 10));
  });

  it("drift: ramalan naik μ per periode", () => {
    const y = Array.from({ length: 40 }, (_, t) => 10 + 2 * t + (t % 2 ? 0.3 : -0.3));
    const m = fitArima(y, { p: 0, d: 1, q: 0, constant: true })!;
    const f = forecastArima(y, m, 3);
    expect(f.mean[1] - f.mean[0]).toBeCloseTo(m.mu, 10);
    expect(m.mu).toBeCloseTo((y[39] - y[0]) / 39, 10); // bentuk tertutup, bukan optimasi
  });
});

describe("SARIMA — bagian musiman", () => {
  it("difference musiman & gabungan", () => {
    expect(seasonalDifference([1, 2, 3, 4, 6, 8, 10, 12], 4, 1)).toEqual([5, 6, 7, 8]);
    expect(differenceAll([1, 2, 3, 4, 6, 8, 10, 12, 15], 1, 1, 4)).toEqual([1, 1, 1, 1]);
  });

  it("ekspansi polinomial multiplikatif", () => {
    // (1 − 0,5B)(1 − 0,3B⁴) = 1 − 0,5B − 0,3B⁴ + 0,15B⁵  →  y_t = 0,5y_{t−1} + 0,3y_{t−4} − 0,15y_{t−5}
    close(expandAr([0.5], [0.3], 4), [0.5, 0, 0, 0.3, -0.15], 12);
    // (1 + 0,4B)(1 + 0,6B⁴) = 1 + 0,4B + 0,6B⁴ + 0,24B⁵
    close(expandMa([0.4], [0.6], 4), [0.4, 0, 0, 0.6, 0.24], 12);
    expect(expandAr([0.5], [], 12)).toEqual([0.5]);
  });

  it("kekuatan musiman F_s: tinggi untuk pola musiman, rendah untuk noise", () => {
    const e = normals(96, 41);
    const seasonal = e.map((v, t) => 50 + 10 * Math.sin((2 * Math.PI * t) / 12) + v);
    expect(seasonalStrength(seasonal, 12)!).toBeGreaterThan(0.9);
    expect(seasonalStrength(e, 12)!).toBeLessThan(0.4);
    expect(seasonalStrength(e.slice(0, 20), 12)).toBeNull(); // < 2 musim
  });

  it("AR musiman murni dengan konstanta: CSS = OLS y_t pada y_{t−12}", () => {
    const e = normals(300, 43);
    const y: number[] = [];
    for (let t = 0; t < 300; t++) y.push(t < 12 ? 25 + e[t] : 10 + 0.6 * y[t - 12] + e[t]);
    const m = fitArima(y, { p: 0, d: 0, q: 0, constant: true, P: 1, D: 0, Q: 0, s: 12 }, 12)!;
    // OLS bentuk tertutup
    const xs = y.slice(0, -12);
    const ys = y.slice(12);
    const mx = xs.reduce((a, v) => a + v, 0) / xs.length;
    const my = ys.reduce((a, v) => a + v, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => {
      sxy += (x - mx) * (ys[i] - my);
      sxx += (x - mx) ** 2;
    });
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    expect(m.Phi[0]).toBeCloseTo(slope, 5);
    expect(m.mu * (1 - m.Phi[0])).toBeCloseTo(intercept, 3);
    expect(m.phi).toEqual([]);
  });

  it("random walk musiman: ramalan = nilai musim lalu, se = σ lalu σ√2", () => {
    const e = normals(80, 47);
    const y: number[] = [];
    for (let t = 0; t < 80; t++) y.push(t < 4 ? 100 + 10 * t : y[t - 4] + e[t]);
    const m = fitArima(y, { p: 0, d: 0, q: 0, constant: false, P: 0, D: 1, Q: 0, s: 4 }, 0)!;
    const f = forecastArima(y, m, 8);
    f.mean.forEach((v, j) => expect(v).toBeCloseTo(y[80 - 4 + (j % 4)], 10));
    const sigma = Math.sqrt(m.sigma2);
    f.se.forEach((s, j) => expect(s).toBeCloseTo(sigma * (j < 4 ? 1 : Math.SQRT2), 10));
    close(psiWeights([], [], 0, 8, 1, 4), [1, 0, 0, 0, 1, 0, 0, 0], 12);
  });

  it("cek akar faktor musiman: |z| = |r|^(1/s)", () => {
    // 1 − 0,9z → akar 1,11; akar Φ(B¹²) = 1,11^(1/12) ≈ 1,0088 < 1,01 → ditolak
    expect(rootsOk({ phi: [], theta: [], Phi: [0.9], Theta: [], s: 12 }).ar).toBe(false);
    expect(rootsOk({ phi: [], theta: [], Phi: [0.5], Theta: [], s: 12 }).ar).toBe(true);
    expect(rootsOk({ phi: [], theta: [], Phi: [], Theta: [-0.995], s: 12 }).ma).toBe(false);
  });

  it("autoArima: data musiman → SARIMA; data non-musiman tetap ARIMA", () => {
    const e = normals(96, 53);
    const seasonal = e.map((v, t) => 300 + 2 * t + 30 * Math.cos((2 * Math.PI * t) / 12) + 4 * v);
    const a = autoArima(seasonal, { s: 12 })!;
    expect(a.differencing.D).toBe(1);
    expect(arimaLabel(a.model)).toMatch(/^SARIMA\(\d,\d,\d\)\(\d,1,\d\)\[12\]/);
    expect(rootsOk(a.model)).toEqual({ ar: true, ma: true });

    const b = autoArima(ref.ar2.data, { s: 12 })!;
    expect(b.differencing.D).toBe(0);
    expect(arimaLabel(b.model)).toMatch(/^ARIMA/);
  });
});

describe("akar polinomial", () => {
  it("modulus akar terkecil benar untuk derajat 1–3", () => {
    expect(minRootModulus([-0.5])).toBeCloseTo(2, 10); // 1 − 0,5z → z = 2
    // 1 − 1,5z + 0,5z² = (1 − z)(1 − 0,5z) → akar 1 dan 2
    expect(minRootModulus([-1.5, 0.5])).toBeCloseTo(1, 8);
    // 1 + 0,25z² → akar ±2i
    expect(minRootModulus([0, 0.25])).toBeCloseTo(2, 8);
    // (1 − 0,5z)(1 + 0,8z)(1 − 0,25z) → akar 2, −1,25, 4
    expect(minRootModulus([0.05, -0.475, 0.1])).toBeCloseTo(1.25, 8);
    expect(minRootModulus([])).toBe(Infinity);
  });

  it("MA dengan akar di lingkaran satuan ditolak, model wajar diterima", () => {
    expect(rootsOk({ phi: [], theta: [0.522, 1.0] }).ma).toBe(false);
    expect(rootsOk({ phi: [0.6, -0.28], theta: [0.4] })).toEqual({ ar: true, ma: true });
    expect(rootsOk({ phi: [0.999], theta: [] }).ar).toBe(false);
  });
});

describe("autoArima", () => {
  it("model terpilih selalu lolos cek akar (|z| ≥ 1,01)", () => {
    for (const y of [ref.ar2.data, ref.randomWalk.data]) {
      const a = autoArima(y)!;
      expect(rootsOk(a.model)).toEqual({ ar: true, ma: true });
    }
  });

  it("model bersarang: ARMA(2,1) tidak lebih buruk dari AR(2) maupun MA(1)", () => {
    // ARMA(2,1) memuat AR(2) (θ=0) dan MA(1) (φ=0) → SS optimumnya harus ≤ keduanya.
    // Dulu Nelder-Mead dari satu titik awal tersangkut di minimum lokal.
    const fit = (p: number, q: number) => fitArima(ref.ar2.data, { p, d: 0, q, constant: true }, 3)!;
    const arma = fit(2, 1);
    expect(arma.sigma2).toBeLessThanOrEqual(fit(2, 0).sigma2 + 1e-7);
    expect(arma.sigma2).toBeLessThanOrEqual(fit(0, 1).sigma2 + 1e-7);
  });

  it("AR(2) stasioner → d = 0, model terpilih tidak kalah AICc dari struktur sebenarnya", () => {
    const a = autoArima(ref.ar2.data)!;
    expect(a.model.d).toBe(0);
    // Pada sampel ini ACF lag-2 ≈ 0 sehingga MA(1) bersaing ketat dengan AR(2) —
    // yang diuji: pilihan AICc konsisten, bukan orde tertentu.
    const ar2 = a.candidates.find((c) => c.p === 2 && c.q === 0)!;
    expect(a.model.aicc).toBeLessThanOrEqual(ar2.aicc);
    expect(a.candidates[0].aicc).toBeLessThanOrEqual(a.candidates[a.candidates.length - 1].aicc);
    // Residual model terpilih white noise.
    expect(ljungBox(a.model.residuals, 10, a.model.p + a.model.q)!.pValue).toBeGreaterThan(0.05);
  });

  it("random walk dengan drift → d = 1", () => {
    const a = autoArima(ref.randomWalk.data)!;
    expect(a.model.d).toBe(1);
    expect(a.differencing.trend).toBe(false);
    // Urutan uji: level d=0 (ditolak) → tren d=0 (ditolak: unit root, bukan tren deterministik) → level d=1 (stasioner)
    expect(a.differencing.steps.map((s) => [s.test, s.d, s.stationary])).toEqual([
      ["level", 0, false],
      ["trend", 0, false],
      ["level", 1, true],
    ]);
  });

  it("tren deterministik + AR(1) → detrend (d = 0 + tren linear), bukan difference", () => {
    const e = normals(120, 17);
    let a = 0;
    const y = e.map((v, t) => (a = 0.6 * a + v) * 50 + 1000 + 12 * t);
    const auto = autoArima(y)!;
    expect(auto.differencing.trend).toBe(true);
    expect(auto.model.d).toBe(0);
    expect(auto.model.trendLine!.slope).toBeCloseTo(12, 0);
    // Ramalan meneruskan tren (bukan mendatar seperti model over-differenced).
    const f = forecastArima(y, auto.model, 12);
    expect(f.mean[11] - f.mean[0]).toBeGreaterThan(12 * 11 * 0.8);
    // Rentang melebar seiring horizon (ARMA + ketidakpastian garis tren).
    expect(f.se[11]).toBeGreaterThan(f.se[0]);
  });

  it("deret pendek tetap aman (orde dibatasi)", () => {
    const y = normals(24, 3).map((v, i) => 100 + i + v);
    const a = autoArima(y)!;
    expect(a.model.p + a.model.q).toBeLessThanOrEqual(2);
  });
});
