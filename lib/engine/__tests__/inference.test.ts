/**
 * Uji inferensi statistik. Nilai acuan dihitung dengan scipy 1.17
 * (scipy.stats.t / f / linregress / f_oneway / skew) supaya implementasi
 * JS bisa dipercaya untuk insight yang dibaca user.
 */
import { describe, it, expect } from "vitest";
import {
  aggregateSeries,
  benjaminiHochberg,
  fSurvival,
  iqrOutliers,
  linreg,
  oneWayAnova,
  pearsonTest,
  predictionInterval,
  robustZScores,
  summarize,
  systematicSample,
  tQuantile,
  tTwoSidedP,
  zOutliers,
} from "../stats";

describe("distribusi t & F", () => {
  it("p-value dua sisi t=2, df=10 sama dengan scipy", () => {
    expect(tTwoSidedP(2, 10)).toBeCloseTo(0.07338803477, 8);
  });

  it("kasus tertutup: df=1 (Cauchy) t=1 → p = 0.5; df=2 t=2 → 1 − 2/√6", () => {
    expect(tTwoSidedP(1, 1)).toBeCloseTo(0.5, 10);
    expect(tTwoSidedP(2, 2)).toBeCloseTo(1 - 2 / Math.sqrt(6), 10);
  });

  it("kuantil t 97.5% (df=10, df=3) sama dengan scipy", () => {
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.2281388519862744, 6);
    expect(tQuantile(0.975, 3)).toBeCloseTo(3.1824463052837078, 6);
  });

  it("survival F sama dengan scipy", () => {
    expect(fSurvival(4, 2, 12)).toBeCloseTo(0.046656, 8);
    expect(fSurvival(3.5, 3, 20)).toBeCloseTo(0.03449310388512439, 8);
  });
});

describe("summarize — variansi sampel & skewness G1", () => {
  it("cocok dengan numpy var(ddof=1) dan scipy skew(bias=False)", () => {
    const s = summarize([2, 3, 3, 4, 4, 4, 5, 9]);
    expect(s.variance).toBeCloseTo(4.5, 10);
    expect(s.skewness).toBeCloseTo(1.8407224145173617, 8);
  });
});

describe("linreg — inferensi & stabilitas numerik", () => {
  it("slope, SE, p-value sama dengan scipy.linregress", () => {
    const r = linreg([1, 2, 3, 4, 5, 6], [2.1, 3.9, 6.2, 7.8, 10.1, 11.7]);
    expect(r.slope).toBeCloseTo(1.9485714285714282, 10);
    expect(r.intercept).toBeCloseTo(0.1466666666666674, 10);
    expect(r.slopeSE).toBeCloseTo(0.04583317872577735, 10);
    expect(r.pValue).toBeCloseTo(1.8298087274313969e-6, 10);
  });

  it("prediction interval 95% di x0=7 sama dengan rumus buku", () => {
    const r = linreg([1, 2, 3, 4, 5, 6], [2.1, 3.9, 6.2, 7.8, 10.1, 11.7]);
    const pi = predictionInterval(r, 7);
    expect(pi.fit).toBeCloseTo(13.786666666666665, 8);
    expect(pi.lower).toBeCloseTo(13.059353449106737, 5);
    expect(pi.upper).toBeCloseTo(14.513979884226593, 5);
  });

  it("REGRESI AUDIT: timestamp epoch per detik tidak membalik arah tren", () => {
    // Versi lama (Σx² − (Σx)²/n) memberi slope −0.245 & R² negatif di kasus ini.
    const t0 = Date.parse("2024-03-01T08:00:00Z");
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 30; i++) {
      x.push(t0 + i * 1000);
      y.push(100 + 2 * i);
    }
    const r = linreg(x, y);
    expect(r.slope * 1000).toBeCloseTo(2, 6);
    expect(r.r2).toBeCloseTo(1, 8);
  });
});

describe("pearsonTest", () => {
  it("r & p-value sama dengan scipy.pearsonr", () => {
    const t = pearsonTest([1, 2, 3, 4, 5], [2, 1, 4, 3, 6]);
    expect(t.r).toBeCloseTo(0.8219949365267865, 10);
    expect(t.pValue).toBeCloseTo(0.0877066470080656, 8);
  });

  it("r=0.82 dengan n=5 TIDAK signifikan (dulu dilabeli 'sangat kuat' tanpa catatan)", () => {
    expect(pearsonTest([1, 2, 3, 4, 5], [2, 1, 4, 3, 6]).pValue).toBeGreaterThan(0.05);
  });
});

describe("benjaminiHochberg", () => {
  it("q-value sesuai prosedur step-up", () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005]);
    expect(q[0]).toBeCloseTo(0.02, 12);
    expect(q[1]).toBeCloseTo(0.04, 12);
    expect(q[2]).toBeCloseTo(0.04, 12);
    expect(q[3]).toBeCloseTo(0.02, 12);
  });
});

describe("oneWayAnova", () => {
  it("F & p-value sama dengan scipy.f_oneway", () => {
    const r = oneWayAnova([[1, 2, 3, 5], [4, 6, 5, 7], [8, 9, 7, 10]]);
    expect(r.F).toBeCloseTo(15.88, 8);
    expect(r.pValue).toBeCloseTo(0.0011169596985993399, 8);
  });

  it("satu grup saja → p = 1 (tidak bisa diuji)", () => {
    expect(oneWayAnova([[1, 2, 3]]).pValue).toBe(1);
  });
});

describe("outlier robust", () => {
  const smallN = [10, 11, 12, 10, 11, 9, 10, 1000];

  it("REGRESI AUDIT: z-score klasik mustahil mendeteksi outlier untuk n=8", () => {
    // |z| maks = (n−1)/√n = 2.47 < 2.5 (bahkan dengan std sampel lebih kecil lagi)
    expect(zOutliers(smallN, 2.5).indices).toEqual([]);
  });

  it("pagar IQR & modified z-score menangkap nilai 1000", () => {
    expect(iqrOutliers(smallN).values).toContain(1000);
    const rz = robustZScores(smallN);
    expect(rz[7]).toBeGreaterThan(3.5);
    expect(Math.abs(rz[0])).toBeLessThan(3.5);
  });

  it("MAD = 0 (mayoritas nilai sama) → fallback mean absolute deviation, tidak NaN", () => {
    const rz = robustZScores([5, 5, 5, 5, 5, 6, 50]);
    expect(rz.every((v) => Number.isFinite(v))).toBe(true);
    expect(rz[6]).toBeGreaterThan(3.5);
  });
});

describe("aggregateSeries & systematicSample", () => {
  it("satu titik per periode, terurut, sum/mean benar", () => {
    const s = aggregateSeries([3, 1, 1, 2, 3], [10, 1, 3, 5, 20], "sum");
    expect(s.x).toEqual([1, 2, 3]);
    expect(s.y).toEqual([4, 5, 30]);
    expect(aggregateSeries([1, 1], [2, 4], "mean").y).toEqual([3]);
  });

  it("sampling sistematik tersebar di seluruh data, bukan cuma kepala", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const s = systematicSample(arr, 5);
    expect(s).toHaveLength(5);
    expect(s[0]).toBeGreaterThan(0);
    expect(s[4]).toBeGreaterThan(80);
  });
});
