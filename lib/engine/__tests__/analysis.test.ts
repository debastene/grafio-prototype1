/**
 * Regression test end-to-end untuk temuan audit engine (Okt 2026).
 * Tiap skenario dulu menghasilkan analisis yang salah/menyesatkan.
 */
import { describe, it, expect } from "vitest";
import { analyzeFile } from "../index";
import { profileTable, tokenizeName } from "../profile";
import type { ParsedRow } from "../parse";

const csvFile = (name: string, lines: string[]) => new File([lines.join("\n")], name, { type: "text/csv" });

describe("tokenizeName & heuristik ID", () => {
  it("tokenisasi camelCase / snake / spasi", () => {
    expect(tokenizeName("CustomerID")).toEqual(["customer", "id"]);
    expect(tokenizeName("paid_amount")).toEqual(["paid", "amount"]);
    expect(tokenizeName("Land Area(Km2)")).toEqual(["land", "area", "km2"]);
  });

  it("REGRESI AUDIT: 'paid', 'humidity', 'width', 'dividend' BUKAN ID; 'customer_id', 'kode_pos' ID", () => {
    const rows: ParsedRow[] = Array.from({ length: 10 }, (_, i) => ({
      paid_amount: 100 + (i % 3),
      humidity: 60 + (i % 4),
      width: 5 + (i % 2),
      dividend_yield: 0.02 * ((i % 3) + 1),
      customer_id: 1000 + i * 7,
      kode_pos: 60111 + (i % 5),
    }));
    const prof = profileTable(Object.keys(rows[0]), rows);
    const isId = (n: string) => prof.find((p) => p.name === n)!.isLikelyId;
    expect(isId("paid_amount")).toBe(false);
    expect(isId("humidity")).toBe(false);
    expect(isId("width")).toBe(false);
    expect(isId("dividend_yield")).toBe(false);
    expect(isId("customer_id")).toBe(true);
    expect(isId("kode_pos")).toBe(true);
  });

  it("REGRESI AUDIT: integer yang semua nilainya unik (GDP, populasi) bukan ID; nomor urut 1..n ID", () => {
    const rows: ParsedRow[] = Array.from({ length: 12 }, (_, i) => ({
      No: i + 1,
      GDP: 1_000_000 + i * 37_123 + (i % 3) * 999,
      Population: 5_000 + i * 131,
    }));
    const prof = profileTable(["No", "GDP", "Population"], rows);
    expect(prof.find((p) => p.name === "No")!.isLikelyId).toBe(true);
    expect(prof.find((p) => p.name === "GDP")!.isLikelyId).toBe(false);
    expect(prof.find((p) => p.name === "Population")!.isLikelyId).toBe(false);
  });
});

describe("data cross-sectional (tanpa kolom waktu)", () => {
  it("REGRESI AUDIT: GDP & Population dianalisis, tidak ada 'tren' palsu dari urutan abjad", async () => {
    const countries = ["Afghanistan", "Brazil", "Chile", "Denmark", "Egypt", "France", "Ghana", "Haiti", "India", "Japan", "Kenya", "Laos"];
    const lines = ["Country,GDP,Population,Life expectancy,Total tax rate"];
    countries.forEach((c, i) => {
      const gdp = 20_000_000 + ((i * 7919) % 13) * 3_100_000 + i * 11;
      const pop = 1_000_000 + ((i * 104729) % 17) * 250_000 + i * 3;
      lines.push(`${c},${gdp},${pop},${(60 + ((i * 3) % 20)).toFixed(1)},${(0.2 + ((i * 5) % 7) / 20).toFixed(3)}`);
    });
    const r = await analyzeFile(csvFile("world.csv", lines), "");
    expect(r.analysis.numericCols).toEqual(expect.arrayContaining(["GDP", "Population"]));
    expect(r.analysis.timeAxis).toBeNull();
    expect(r.analysis.trends).toEqual([]);
    expect(r.kpis.every((k) => k.change === null)).toBe(true);
    expect(r.insights.some((i) => i.type === "trend")).toBe(false);
  });
});

describe("data bulanan dengan nama bulan Indonesia", () => {
  it("REGRESI AUDIT: kolom 'bulan' (Januari..Desember) jadi sumbu waktu, tren penjualan terdeteksi", async () => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const lines = ["bulan,penjualan,humidity,paid_amount"];
    months.forEach((m, i) => lines.push(`${m},${100 + i * 20 + (i % 2) * 3},${60 + (i % 3)},${500 + i * 7}`));
    const r = await analyzeFile(csvFile("sales.csv", lines), "");
    expect(r.analysis.numericCols).toEqual(expect.arrayContaining(["penjualan", "humidity", "paid_amount"]));
    expect(r.analysis.timeAxis?.column).toBe("bulan");
    const t = r.analysis.trends.find((x) => x.column === "penjualan")!;
    expect(t.direction).toBe("naik");
    expect(t.significant).toBe(true);
    expect(t.periods).toBe(12);
    expect(t.forecast).toHaveLength(3);
    expect(t.forecastLower![0]).toBeLessThan(t.forecast[0]);
    // KPI sparkline = data asli per bulan, bukan gelombang sinus
    const kpi = r.kpis.find((k) => k.label === "penjualan")!;
    expect(kpi.spark).toHaveLength(12);
    expect(kpi.spark![0]).toBe(100);
  });

  it("kolom tahun numerik dipakai sebagai sumbu waktu, bukan metrik KPI", async () => {
    const lines = ["tahun,pendapatan"];
    for (let y = 2015; y <= 2024; y++) lines.push(`${y},${1000 + (y - 2015) * 50 + ((y * 7) % 5)}`);
    const r = await analyzeFile(csvFile("tahunan.csv", lines), "");
    expect(r.analysis.timeAxis).toMatchObject({ column: "tahun", kind: "year" });
    expect(r.analysis.numericCols).not.toContain("tahun");
    expect(r.kpis.map((k) => k.label)).not.toContain("tahun");
  });
});

describe("data transaksi (banyak baris per tanggal, DD/MM/YYYY)", () => {
  const build = (perDay: (d: number, k: number) => number) => {
    const lines = ["tanggal,nominal"];
    for (let d = 1; d <= 28; d++) {
      for (let k = 0; k < 3; k++) lines.push(`${String(d).padStart(2, "0")}/01/2024,${perDay(d, k)}`);
    }
    return lines;
  };

  it("REGRESI AUDIT: tren dihitung per HARI (28 periode), bukan transaksi pertama vs terakhir", async () => {
    // Nominal stabil, tapi transaksi pertama sangat kecil & terakhir sangat besar.
    const r = await analyzeFile(
      csvFile("trx.csv", build((d, k) => (d === 1 && k === 0 ? 20 : d === 28 && k === 2 ? 190 : 100 + ((d * 7 + k * 13) % 11) - 5))),
      "",
    );
    expect(r.profile.find((p) => p.name === "tanggal")!.type).toBe("date");
    const t = r.analysis.trends[0];
    expect(t.periods).toBe(28);
    // Dulu: (190 − 20)/20 = +850%. Sekarang perubahan menurut garis tren harian.
    expect(Math.abs(t.pctChange)).toBeLessThan(20);
  });

  it("tren naik harian yang nyata → signifikan, ada forecast + interval", async () => {
    const r = await analyzeFile(csvFile("trx-up.csv", build((d, k) => 100 + d * 4 + ((d + k) % 3))), "");
    const t = r.analysis.trends[0];
    expect(t.direction).toBe("naik");
    expect(t.pValue!).toBeLessThan(0.001);
    expect(t.aggregation).toBe("sum");
    expect(r.charts.primary.labels).toHaveLength(28);
  });
});

describe("outlier & korelasi", () => {
  it("REGRESI AUDIT: n=8 dengan nilai 1000 → anomali terdeteksi (dulu 0)", async () => {
    const lines = ["x", ...[10, 11, 12, 10, 11, 9, 10, 1000].map(String)];
    const r = await analyzeFile(csvFile("small.csv", lines), "");
    expect(r.analysis.anomalies[0]?.count).toBe(1);
    expect(r.analysis.anomalies[0]?.topExample?.value).toBe(1000);
  });

  it("korelasi kebetulan dengan n kecil tidak dilaporkan; korelasi kuat & signifikan dilaporkan", async () => {
    const noise = ["a,b", "1,2", "2,1", "3,4", "4,3", "5,6"]; // r=0.82, p=0.088
    const r1 = await analyzeFile(csvFile("noise.csv", noise), "");
    expect(r1.analysis.correlations).toEqual([]);

    // (a bukan 0,1,2,… berurutan — kolom seperti itu memang dianggap nomor baris)
    const strong = ["a,b", ...Array.from({ length: 30 }, (_, i) => `${i * 3 + (i % 2)},${2 * i + (i % 4)}`)];
    const r2 = await analyzeFile(csvFile("strong.csv", strong), "");
    expect(r2.analysis.correlations[0]).toMatchObject({ a: "a", b: "b" });
    expect(r2.analysis.correlations[0].qValue!).toBeLessThan(0.05);
  });

  it("segmen: grup beranggota 1 tidak boleh jadi 'pemenang'", async () => {
    const lines = ["kota,omzet"];
    for (let i = 0; i < 6; i++) lines.push(`Surabaya,${100 + i}`);
    for (let i = 0; i < 6; i++) lines.push(`Malang,${102 + i}`);
    lines.push("Batu,5000"); // satu baris saja
    const r = await analyzeFile(csvFile("seg.csv", lines), "");
    const seg = r.analysis.segments[0];
    expect(seg.groups.map((g) => g.name)).not.toContain("Batu");
    expect(seg.significant).toBe(false);
  });
});

describe("batas ukuran file", () => {
  it("file > 5 MB ditolak dengan pesan jelas (tidak dipotong diam-diam)", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.csv");
    await expect(analyzeFile(big, "")).rejects.toThrow(/melebihi batas 5 MB/);
  });

  it("format biner ditolak dengan saran konversi", async () => {
    const f = new File(["x"], "data.xlsx");
    await expect(analyzeFile(f, "")).rejects.toThrow(/belum didukung/);
  });
});
