import { describe, it, expect } from "vitest";
import {
  clean,
  quantile,
  summarize,
  pearson,
  linreg,
  zOutliers,
  iqrOutliers,
  freq,
  groupBy,
  compactNumber,
  formatByType,
} from "../stats";

describe("clean", () => {
  it("buang null/undefined/NaN/Infinity, sisakan angka valid", () => {
    expect(clean([1, null, 2, undefined, NaN, Infinity, -3])).toEqual([1, 2, -3]);
  });

  it("array kosong → array kosong", () => {
    expect(clean([])).toEqual([]);
  });
});

describe("quantile", () => {
  it("median array genap = interpolasi tengah", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("q0 = min, q1 = max", () => {
    expect(quantile([1, 5, 9], 0)).toBe(1);
    expect(quantile([1, 5, 9], 1)).toBe(9);
  });

  it("array kosong → NaN", () => {
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe("summarize", () => {
  it("statistik dasar [1..5] benar", () => {
    const s = summarize([1, 2, 3, 4, 5]);
    expect(s.count).toBe(5);
    expect(s.sum).toBe(15);
    expect(s.mean).toBe(3);
    expect(s.median).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.range).toBe(4);
    // Population variance: ((-2)²+(-1)²+0+1²+2²)/5 = 2
    expect(s.variance).toBe(2);
    expect(s.std).toBeCloseTo(Math.sqrt(2), 10);
    expect(s.q1).toBe(2);
    expect(s.q3).toBe(4);
    expect(s.iqr).toBe(2);
    expect(s.skewness).toBeCloseTo(0, 10); // simetris
    expect(s.cv).toBeCloseTo(Math.sqrt(2) / 3, 10);
  });

  it("array kosong → semua nol (tidak NaN)", () => {
    const s = summarize([]);
    expect(s.count).toBe(0);
    expect(s.mean).toBe(0);
    expect(s.std).toBe(0);
  });

  it("satu elemen → std 0, skewness 0 (tidak NaN karena divide-by-zero)", () => {
    const s = summarize([7]);
    expect(s.mean).toBe(7);
    expect(s.std).toBe(0);
    expect(s.skewness).toBe(0);
    expect(s.cv).toBe(0);
  });

  it("tidak memodifikasi array input (sort harus di-copy)", () => {
    const arr = [3, 1, 2];
    summarize(arr);
    expect(arr).toEqual([3, 1, 2]);
  });

  it("distribusi right-skewed → skewness positif", () => {
    const s = summarize([1, 1, 1, 1, 10]);
    expect(s.skewness).toBeGreaterThan(0);
  });
});

describe("pearson", () => {
  it("hubungan linear sempurna positif → r = 1", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it("hubungan linear sempurna negatif → r = -1", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it("variabel konstan → 0 (bukan NaN)", () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });

  it("kurang dari 2 titik → 0", () => {
    expect(pearson([1], [2])).toBe(0);
    expect(pearson([], [])).toBe(0);
  });

  it("panjang beda → pakai yang terpendek", () => {
    expect(pearson([1, 2, 3, 999], [2, 4, 6])).toBeCloseTo(1, 10);
  });
});

describe("linreg", () => {
  it("y = 2x + 1 → slope 2, intercept 1, r² = 1", () => {
    const r = linreg([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it("x konstan (denom 0) → slope 0, intercept = mean(y)", () => {
    const r = linreg([5, 5, 5], [1, 2, 3]);
    expect(r.slope).toBe(0);
    expect(r.intercept).toBe(2);
    expect(r.r2).toBe(0);
  });

  it("kurang dari 2 titik → nol semua", () => {
    expect(linreg([1], [1])).toEqual({ slope: 0, intercept: 0, r2: 0 });
  });

  it("data noisy → 0 < r² < 1", () => {
    const r = linreg([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
    expect(r.r2).toBeGreaterThan(0.9);
    expect(r.r2).toBeLessThanOrEqual(1);
  });
});

describe("zOutliers", () => {
  it("deteksi spike ekstrem dengan index yang benar", () => {
    const arr = [10, 11, 9, 10, 12, 10, 11, 9, 10, 100];
    const out = zOutliers(arr, 2.5);
    expect(out.indices).toContain(9);
    expect(out.values).toContain(100);
    expect(Math.abs(out.zscores[out.indices.indexOf(9)])).toBeGreaterThanOrEqual(2.5);
  });

  it("data konstan (std 0) → tidak ada outlier, tidak crash", () => {
    const out = zOutliers([5, 5, 5, 5]);
    expect(out.indices).toEqual([]);
  });
});

describe("iqrOutliers", () => {
  it("deteksi nilai di luar 1.5×IQR fence", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];
    const out = iqrOutliers(arr);
    expect(out.values).toContain(100);
    expect(out.values).not.toContain(5);
  });
});

describe("freq", () => {
  it("hitung frekuensi, sort descending, pct benar", () => {
    const f = freq(["a", "b", "a", "a", "b", "c"]);
    expect(f[0]).toEqual({ value: "a", count: 3, pct: 0.5 });
    expect(f[1]).toEqual({ value: "b", count: 2, pct: 2 / 6 });
    expect(f[2].value).toBe("c");
  });
});

describe("groupBy", () => {
  it("group per key, skip null key/value & non-finite", () => {
    const rows = [
      { k: "a", v: 1 },
      { k: "a", v: 2 },
      { k: "b", v: 3 },
      { k: null as string | null, v: 4 },
      { k: "b", v: null as number | null },
    ];
    const m = groupBy(rows, (r) => r.k, (r) => r.v);
    expect(m.get("a")).toEqual([1, 2]);
    expect(m.get("b")).toEqual([3]);
    expect(m.size).toBe(2);
  });
});

describe("compactNumber", () => {
  it("skala K/M/B/T", () => {
    expect(compactNumber(1500)).toBe("1.5K");
    expect(compactNumber(1234567)).toBe("1.2M");
    expect(compactNumber(2_000_000_000)).toBe("2.0B");
    expect(compactNumber(3_500_000_000_000)).toBe("3.5T");
  });

  it("angka kecil pakai desimal", () => {
    expect(compactNumber(150)).toBe("150");
    expect(compactNumber(5.5)).toBe("5.50");
    expect(compactNumber(0.1234)).toBe("0.123");
  });

  it("angka negatif tetap terformat", () => {
    expect(compactNumber(-1500)).toBe("-1.5K");
  });
});

describe("formatByType", () => {
  it("percent: 0.123 → 12.3%", () => {
    expect(formatByType(0.123, "percent")).toBe("12.3%");
  });

  it("currency dengan hint rupiah → prefix Rp", () => {
    expect(formatByType(1500000, "currency", "harga_rp")).toBe("Rp 1.5M");
    expect(formatByType(1500000, "currency", "pendapatan_idr")).toBe("Rp 1.5M");
  });

  it("currency tanpa hint → prefix $", () => {
    expect(formatByType(1500, "currency", "price")).toBe("$1.5K");
  });

  it("tipe lain → compact biasa", () => {
    expect(formatByType(1234567, "number")).toBe("1.2M");
  });
});
