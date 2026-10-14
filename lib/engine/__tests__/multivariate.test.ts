/**
 * Analisis multivariat — nilai acuan dari numpy 2.4 / scipy 1.17 /
 * scikit-learn 1.8 (np.linalg.eigh, scipy.stats.chi2, silhouette_score).
 */
import { describe, it, expect } from "vitest";
import {
  computeMultivariate,
  jacobiEigen,
  kmeans,
  kmoLabel,
  runPca,
  silhouetteScore,
  silhouetteStructure,
} from "../multivariate";
import { chiSquareSurvival } from "../stats";
import { profileTable } from "../profile";
import { analyzeFile } from "../index";
import { answerQuery } from "../query";
import type { ParsedRow } from "../parse";

describe("chiSquareSurvival", () => {
  it("sama dengan scipy.stats.chi2.sf", () => {
    expect(chiSquareSurvival(3.84, 1)).toBeCloseTo(0.05004352124870519, 9);
    expect(chiSquareSurvival(10, 4)).toBeCloseTo(0.04042768199451279, 9);
    expect(chiSquareSurvival(50, 20)).toBeCloseTo(0.0002214766382487835, 11);
    expect(chiSquareSurvival(0.5, 3)).toBeCloseTo(0.9188914116546758, 9);
  });
});

describe("jacobiEigen", () => {
  it("nilai eigen matriks simetris sama dengan numpy.linalg.eigvalsh", () => {
    const M = [
      [4, 1, 2, 0.5],
      [1, 3, 0.2, 1],
      [2, 0.2, 5, 0.3],
      [0.5, 1, 0.3, 2],
    ];
    const { values, vectors } = jacobiEigen(M);
    const ref = [6.846933040608025, 3.6817426252171352, 2.1224649996598886, 1.3488593345149504];
    values.forEach((v, i) => expect(v).toBeCloseTo(ref[i], 10));
    // M v = λ v untuk eigenvektor pertama
    const v0 = vectors.map((r) => r[0]);
    const Mv = M.map((row) => row.reduce((s, m, j) => s + m * v0[j], 0));
    Mv.forEach((x, i) => expect(x).toBeCloseTo(values[0] * v0[i], 10));
  });
});

describe("runPca", () => {
  // 40 baris × 4 kolom deterministik (sama dengan skrip acuan numpy)
  const n = 40;
  const X = Array.from({ length: n }, (_, i) => [i, 2 * i + (i % 5), (i * 7) % 11, 3 * i - (i % 3) * 2 + (i % 7)]);
  const means = [0, 1, 2, 3].map((j) => X.reduce((s, r) => s + r[j], 0) / n);
  const sds = [0, 1, 2, 3].map((j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / (n - 1)));
  const Z = X.map((r) => r.map((v, j) => (v - means[j]) / sds[j]));
  const { result } = runPca(Z, ["a", "b", "c", "d"]);

  it("nilai eigen, variansi dijelaskan, loading PC1 sama dengan numpy", () => {
    const eig = [2.999677371778879, 0.9943853395663976, 0.004416709441146, 0.0015205792135775005];
    result.eigenvalues.forEach((v, i) => expect(v).toBeCloseTo(eig[i], 8));
    expect(result.explained[0]).toBeCloseTo(0.7499193429447198, 9);
    expect(result.cumulative[1]).toBeCloseTo(0.7499193429447198 + 0.24859633489159944, 9);
    const load = [0.9988737505233835, 0.9985844783780732, 0.09181947939660172, 0.9981617228886094];
    result.loadings.forEach((row, i) => expect(Math.abs(row[0])).toBeCloseTo(load[i], 7));
    expect(result.kaiserComponents).toBe(1);
  });

  it("uji Bartlett & KMO sama dengan rumus buku (numpy/scipy)", () => {
    expect(result.bartlett.chi2).toBeCloseTo(398.4685260080011, 5);
    expect(result.bartlett.df).toBe(6);
    expect(result.bartlett.pValue).toBeLessThan(1e-80);
    expect(result.kmo!).toBeCloseTo(0.7573714537132088, 6);
    expect(kmoLabel(result.kmo!)).toBe("cukup");
  });
});

describe("silhouette & k-means", () => {
  const pts = [
    [0, 0], [0, 1], [1, 0], [10, 10], [10, 11], [11, 10], [0, 0.5], [10.5, 10],
  ];

  it("silhouette sama dengan sklearn.metrics.silhouette_score", () => {
    expect(silhouetteScore(pts, [0, 0, 0, 1, 1, 1, 0, 1], 2)).toBeCloseTo(0.9348715416891652, 10);
    expect(silhouetteScore(pts, [0, 1, 0, 1, 0, 1, 0, 1], 2)).toBeCloseTo(0.21542169329018535, 10);
  });

  it("k-means memisahkan dua kelompok yang jelas & deterministik", () => {
    const a = kmeans(pts, 2);
    const b = kmeans(pts, 2);
    expect(a.labels).toEqual(b.labels);
    expect(new Set(a.labels.slice(0, 3)).size).toBe(1);
    expect(a.labels[0]).not.toBe(a.labels[3]);
  });

  it("label struktur silhouette (Kaufman & Rousseeuw)", () => {
    expect(silhouetteStructure(0.8)).toBe("kuat");
    expect(silhouetteStructure(0.6)).toBe("wajar");
    expect(silhouetteStructure(0.3)).toBe("lemah");
    expect(silhouetteStructure(0.1)).toBe("tidak ada");
  });
});

describe("computeMultivariate", () => {
  /** 3 kelompok terpisah jelas di 4 kolom, 30 baris per kelompok. */
  function blobs(): ParsedRow[] {
    const centers = [
      [10, 200, 5, 50],
      [40, 100, 20, 10],
      [70, 300, 35, 90],
    ];
    const rows: ParsedRow[] = [];
    centers.forEach((c, g) => {
      for (let i = 0; i < 30; i++) {
        const jitter = ((i * 37 + g * 11) % 13) / 13 - 0.5;
        rows.push({ omzet: c[0] + jitter * 4, kunjungan: c[1] + jitter * 15, durasi: c[2] + jitter * 2, rating: c[3] + jitter * 5 });
      }
    });
    return rows;
  }

  it("menemukan k=3 dengan struktur kuat; profil klaster masuk akal", () => {
    const rows = blobs();
    const prof = profileTable(Object.keys(rows[0]), rows);
    const mv = computeMultivariate(prof, ["omzet", "kunjungan", "durasi", "rating"])!;
    expect(mv.n).toBe(90);
    expect(mv.clusters!.k).toBe(3);
    expect(mv.clusters!.structure).toBe("kuat");
    expect(mv.clusters!.profiles.map((p) => p.size)).toEqual([30, 30, 30]);
    expect(mv.pca!.bartlett.pValue).toBeLessThan(0.001);
    expect(mv.points.length).toBe(90);
    expect(new Set(mv.points.map((p) => p.cluster))).toEqual(new Set([1, 2, 3]));
  });

  it("deterministik — dua kali jalan, hasil identik", () => {
    const rows = blobs();
    const prof = profileTable(Object.keys(rows[0]), rows);
    const a = computeMultivariate(prof, ["omzet", "kunjungan", "durasi", "rating"]);
    const b = computeMultivariate(prof, ["omzet", "kunjungan", "durasi", "rating"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("kolom yang banyak kosong dikeluarkan (bukan membuang mayoritas baris)", () => {
    const rows = blobs().map((r, i) => ({ ...r, sisa: i % 2 === 0 ? null : i }));
    const prof = profileTable(Object.keys(rows[0]), rows);
    const mv = computeMultivariate(prof, ["omzet", "kunjungan", "durasi", "rating", "sisa"])!;
    expect(mv.columns).not.toContain("sisa");
    expect(mv.excluded).toContainEqual({ column: "sisa", reason: "terlalu banyak nilai kosong" });
    expect(mv.n).toBe(90);
  });

  it("data terlalu kecil → PCA/klaster tidak dihitung, dengan catatan", () => {
    const rows = blobs().slice(0, 12);
    const prof = profileTable(Object.keys(rows[0]), rows);
    const mv = computeMultivariate(prof, ["omzet", "kunjungan", "durasi", "rating"])!;
    expect(mv.pca).toBeNull();
    expect(mv.clusters).toBeNull();
    expect(mv.notes.length).toBeGreaterThan(0);
  });

  it("data acak tanpa kelompok → struktur dilaporkan lemah/tidak ada (jujur)", () => {
    const rows: ParsedRow[] = Array.from({ length: 120 }, (_, i) => ({
      a: (i * 7919) % 101,
      b: (i * 104729) % 97,
      c: (i * 1299709) % 89,
    }));
    const prof = profileTable(["a", "b", "c"], rows);
    const mv = computeMultivariate(prof, ["a", "b", "c"])!;
    expect(["lemah", "tidak ada"]).toContain(mv.clusters!.structure);
    expect(mv.pca!.bartlett.pValue).toBeGreaterThan(0.05); // kolom tidak berkorelasi → PCA tidak layak
  });

  it("kolom positif yang sangat miring di-log(1+x) dan dicatat", () => {
    const rows: ParsedRow[] = Array.from({ length: 60 }, (_, i) => ({
      populasi: i < 57 ? 1000 + i * 10 : 5_000_000 * (i - 55),
      skor: 50 + ((i * 7) % 11),
      jarak: 10 + ((i * 5) % 13),
    }));
    const prof = profileTable(["populasi", "skor", "jarak"], rows);
    const mv = computeMultivariate(prof, ["populasi", "skor", "jarak"])!;
    expect(mv.transformed).toEqual(["populasi"]);
    expect(mv.notes.join(" ")).toMatch(/log\(1\+x\)/);
  });

  it("REGRESI UJI-DATA: klaster < 5% ditandai outlier, bukan 'segmen kuat'", async () => {
    // 58 baris satu gumpalan + 2 baris sangat ekstrem; ada nilai negatif → tidak di-log.
    const rows = Array.from({ length: 60 }, (_, i) =>
      i < 58
        ? `${((i * 37) % 23) / 10 - 1},${((i * 53) % 19) / 10 - 1},${((i * 29) % 17) / 10 - 1}`
        : `${900 + i},${800 + i},${700 + i}`,
    );
    const r = await analyzeFile(new File([["a,b,c", ...rows].join("\n")], "x.csv"), "");
    const c = r.multivariate!.clusters!;
    expect(c.tinyClusters!.length).toBeGreaterThan(0);
    expect(r.insights.some((i) => i.title === "Tidak ada segmen yang bermakna")).toBe(true);
    expect(r.insights.some((i) => i.title.startsWith("Data terbagi jadi"))).toBe(false);
  });

  it("terintegrasi di analyzeFile + insight klaster", async () => {
    const rows = blobs();
    const csv = ["omzet,kunjungan,durasi,rating", ...rows.map((r) => [r.omzet, r.kunjungan, r.durasi, r.rating].join(","))];
    const r = await analyzeFile(new File([csv.join("\n")], "toko.csv"), "");
    expect(r.multivariate?.clusters?.k).toBe(3);
    expect(r.insights.some((i) => i.title.includes("kelompok"))).toBe(true);

    // Chat engine menjawab dari hasil hitungan (tanpa AI)
    const ans = answerQuery("ada berapa klaster di data ini?", r);
    expect(ans.text).toMatch(/k-means memilih 3 kelompok/);
    expect(answerQuery("hasil PCA?", r).text).toMatch(/PC1 menjelaskan/);
  });
});
