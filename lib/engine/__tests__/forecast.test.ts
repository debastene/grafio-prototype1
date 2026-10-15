import { describe, expect, it } from "vitest";
import { analyzeFile } from "../index";
import { arimaEquation, forecastErrors, forecastSeries, mapeLabel, regularize, RegularSeries } from "../forecast";
import { answerQuery } from "../query";
import { mulberry32 } from "../multivariate";

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

function normals(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const u = Math.max(rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  });
}

const ok = (r: RegularSeries | { reason: string }): RegularSeries => {
  if ("reason" in r) throw new Error(r.reason);
  return r;
};

describe("regularize — deret waktu reguler", () => {
  it("transaksi harian 2+ tahun (> 500 hari) → mingguan, dijumlah per minggu", () => {
    const xs: number[] = [];
    const ys: number[] = [];
    // Senin 1 Jan 2024 s.d. Minggu 29 Des 2024+… : 3 transaksi per hari, 735 hari (105 minggu penuh)
    for (let d = 0; d < 735; d++) {
      for (let k = 0; k < 3; k++) {
        xs.push(utc(2024, 1, 1) + d * DAY + k * 3_600_000);
        ys.push(10);
      }
    }
    const s = ok(regularize(xs, ys, "epoch", "sum"));
    expect(s.granularity).toBe("minggu");
    expect(s.values.length).toBe(105);
    expect(s.values.every((v) => v === 210)).toBe(true);
    expect(s.labels[0]).toBe("Mg 1 Jan 2024");
    expect(s.futureLabels(1)[0]).toBe("Mg 5 Jan 2026");
  });

  it("minggu terakhir yang baru berjalan 2 hari dibuang (metrik dijumlah)", () => {
    const xs: number[] = [];
    const ys: number[] = [];
    // Senin 1 Jan 2024 … Selasa: 100 minggu penuh + 2 hari
    for (let d = 0; d < 702; d++) {
      xs.push(utc(2024, 1, 1) + d * DAY);
      ys.push(5);
    }
    // Sebagian minggu kosong supaya granularitas harian ditolak? Tidak perlu: 702 hari > 500 → mingguan.
    const s = ok(regularize(xs, ys, "epoch", "sum"));
    expect(s.granularity).toBe("minggu");
    expect(s.droppedEdges.length).toBe(1);
    expect(s.values.length).toBe(100);
    expect(s.values[s.values.length - 1]).toBe(35); // bukan 10 (minggu parsial)
    // Untuk rata-rata, periode parsial tidak bias → tetap diikutkan.
    expect(ok(regularize(xs, ys, "epoch", "mean")).values.length).toBe(101);
  });

  it("data bursa Senin–Jumat → deret hari kerja tanpa periode kosong", () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let d = 0; d < 280; d++) {
      const day = utc(2025, 1, 6) / DAY + d; // Senin 6 Jan 2025
      if (((day + 3) % 7) >= 5) continue;
      xs.push(day * DAY);
      ys.push(1000 + d);
    }
    const s = ok(regularize(xs, ys, "epoch", "mean"));
    expect(s.granularity).toBe("hari kerja");
    expect(s.values.length).toBe(200);
    expect(s.filled).toBe(0);
    expect(s.seasonalPeriod).toBe(5);
    // Setelah Jumat, periode berikutnya adalah Senin.
    expect(s.labels[4]).toBe("10 Jan 2025");
    expect(s.labels[5]).toBe("13 Jan 2025");
  });

  it("transaksi tiap tgl 1–3 → bulanan; bulan terakhir yang baru tgl 1 dibuang, bulan lengkap tidak", () => {
    const build = (extraPartial: boolean) => {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let m = 0; m < 30; m++) {
        for (const d of [1, 2, 3]) {
          xs.push(Date.UTC(2023, m, d));
          ys.push(100);
        }
      }
      if (extraPartial) {
        xs.push(Date.UTC(2023, 30, 1));
        ys.push(100);
      }
      return ok(regularize(xs, ys, "epoch", "sum"));
    };
    const s = build(true);
    expect(s.granularity).toBe("bulan");
    expect(s.droppedEdges).toEqual(["Jul 2025"]);
    expect(s.values.length).toBe(30);
    expect(s.futureLabels(2)).toEqual(["Jul 2025", "Agu 2025"]);
    // Pola "selalu di awal bulan" bukan tanda periode parsial.
    expect(build(false).droppedEdges).toEqual([]);
  });

  it("tahun-bulan dengan satu bulan hilang → diisi interpolasi linear", () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k < 24; k++) {
      if (k === 10) continue;
      xs.push(2024 * 12 + k);
      ys.push(k * 2);
    }
    const s = ok(regularize(xs, ys, "yearMonth", "sum"));
    expect(s.filled).toBe(1);
    expect(s.values[10]).toBeCloseTo(20, 10);
    expect(s.labels[0]).toBe("Jan 2024");
  });

  it("periode terlalu jarang → alasan, bukan deret", () => {
    const r = regularize([2000, 2005, 2010, 2020], [1, 2, 3, 4], "year", "sum");
    expect("reason" in r).toBe(true);
  });
});

describe("forecastSeries", () => {
  const series = (values: number[], period: number | null = 12): RegularSeries => ({
    values,
    labels: values.map((_, i) => `P${i + 1}`),
    futureLabels: (h) => Array.from({ length: h }, (_, i) => `P${values.length + i + 1}`),
    granularity: "bulan",
    seasonalPeriod: period,
    filled: 0,
    droppedEdges: [],
  });

  it("deret pendek (< 20 periode) dilewati dengan alasan", () => {
    const r = forecastSeries("x", series(Array.from({ length: 12 }, (_, i) => i)), "sum");
    expect("reason" in r && r.reason).toMatch(/minimal 20 periode/);
  });

  it("tren + noise AR(1): model, interval melebar, holdout tersedia", () => {
    const e = normals(80, 5);
    let a = 0;
    const y = e.map((v, t) => (a = 0.6 * a + v) + 100 + 0.8 * t);
    const r = forecastSeries("omzet", series(y, null), "sum");
    if ("reason" in r) throw new Error(r.reason);
    expect(r.future.mean.length).toBe(12); // round(80/6) = 13 → maks 12
    for (let i = 1; i < r.future.mean.length; i++) {
      expect(r.future.upper[i] - r.future.lower[i]).toBeGreaterThanOrEqual(r.future.upper[i - 1] - r.future.lower[i - 1] - 1e-9);
    }
    expect(r.future.mean[0]).toBeGreaterThan(r.future.lower[0]);
    expect(r.holdout).not.toBeNull();
    expect(r.holdout!.h).toBe(12); // 20% dari 80 = 16 → maks 12
    expect(r.identification.acf.length).toBe(r.identification.pacf.length);
    expect(r.diagnostics.ljungBox).not.toBeNull();
  });

  it("pola musiman 12 bulan terdeteksi & diberi catatan", () => {
    const e = normals(60, 9);
    const y = e.map((v, t) => 200 + 40 * Math.sin((2 * Math.PI * t) / 12) + 3 * v);
    const r = forecastSeries("penjualan", series(y), "sum");
    if ("reason" in r) throw new Error(r.reason);
    expect(r.seasonality?.significant).toBe(true);
    expect(r.notes.join(" ")).toMatch(/musiman/);
  });
});

describe("metrik akurasi", () => {
  it("RMSE, MAE, MAPE + kriteria Lewis", () => {
    const e = forecastErrors([100, 200], [110, 180]);
    expect(e.rmse).toBeCloseTo(Math.sqrt((100 + 400) / 2), 10);
    expect(e.mae).toBe(15);
    expect(e.mape).toBeCloseTo(10, 10);
    expect(forecastErrors([0, 1], [1, 1]).mape).toBeNull();
    expect(mapeLabel(8)).toBe("sangat akurat");
    expect(mapeLabel(35)).toBe("wajar");
  });
});

describe("integrasi analyzeFile", () => {
  it("penjualan bulanan 5 tahun → ramalan ARIMA tersimpan di hasil", async () => {
    const e = normals(60, 21);
    let a = 0;
    const lines = ["tanggal,penjualan"];
    for (let k = 0; k < 60; k++) {
      a = 0.5 * a + e[k];
      const d = new Date(Date.UTC(2021, k, 1)).toISOString().slice(0, 10);
      lines.push(`${d},${Math.round(5000 + 40 * k + 300 * a)}`);
    }
    const t0 = performance.now();
    const r = await analyzeFile(new File([lines.join("\n")], "penjualan.csv"), "");
    const ms = performance.now() - t0;
    const f = r.forecasts?.items[0];
    expect(f?.column).toBe("penjualan");
    expect(f?.granularity).toBe("bulan");
    expect(f?.n).toBe(60);
    expect(f?.future.labels[0]).toBe("Jan 2026");
    expect(f?.model.label).toMatch(/^ARIMA\(\d,\d,\d\)/);
    expect(ms).toBeLessThan(3000);
  });

  it("chat & insight menjawab dari hasil ARIMA", async () => {
    const lines = ["tanggal,penjualan"];
    const e = normals(48, 33);
    for (let k = 0; k < 48; k++) {
      lines.push(`${new Date(Date.UTC(2022, k, 1)).toISOString().slice(0, 10)},${Math.round(3000 + 25 * k + 150 * e[k])}`);
    }
    const r = await analyzeFile(new File([lines.join("\n")], "jual.csv"), "");
    const ans = answerQuery("ramalan penjualan 6 bulan ke depan?", r);
    expect(ans.text).toMatch(/^ARIMA\(\d,\d,\d\)/);
    expect(ans.text).toMatch(/KPSS/);
    expect(ans.data?.kind).toBe("table");
    expect(answerQuery("model arima apa yang dipakai?", r).text).toMatch(/Ljung-Box/);
    const ins = r.insights.find((i) => i.title.startsWith("Ramalan penjualan"));
    expect(ins?.body).toMatch(/rentang 95%/);
  });

  it("persamaan model: bentuk Unicode untuk UI, ASCII untuk PDF", () => {
    const m = { label: "", p: 1, d: 1, q: 1, constant: true, phi: [0.5], theta: [-0.3], mu: 2, sigma2: 1, aicc: 0, nEff: 10 };
    expect(arimaEquation(m)).toBe("(1 − 0.500B)(1 − B)yₜ = 1.00 + (1 − 0.300B)eₜ");
    expect(arimaEquation(m, true)).toBe("(1 - 0.500B)(1 - B)y_t = 1.00 + (1 - 0.300B)e_t");
  });

  it("data tanpa kolom waktu → forecasts null", async () => {
    const r = await analyzeFile(new File(["a,b\n1,2\n3,4\n5,7\n8,9\n2,1"], "x.csv"), "");
    expect(r.forecasts).toBeNull();
  });
});
