import { describe, expect, it } from "vitest";
import {
  aucScore,
  classifyTable,
  classTargetCandidates,
  evaluate,
  gini,
  mcnemarTest,
  pickClassTarget,
  stratifiedSplit,
} from "../classify";
import { profileTable } from "../profile";
import { analyzeFile } from "../index";
import { answerQuery } from "../query";
import { churnCsv } from "./fixtures/churn";
import { mulberry32 } from "../multivariate";
import type { ParsedRow } from "../parse";
import type { ParsedIntent } from "../intent";

const ok = <T,>(r: T | { reason: string }): T => {
  if (r && typeof r === "object" && "reason" in (r as object)) throw new Error((r as { reason: string }).reason);
  return r as T;
};

function table(rows: ParsedRow[]) {
  return { rows, profiles: profileTable(Object.keys(rows[0]), rows) };
}

describe("metrik & uji", () => {
  it("Gini impurity", () => {
    expect(gini([5, 5], 10)).toBeCloseTo(0.5, 12);
    expect(gini([10, 0], 10)).toBe(0);
    expect(gini([1, 1, 1], 3)).toBeCloseTo(2 / 3, 12);
  });

  it("McNemar: χ² koreksi kontinuitas & binomial eksak sama dengan scipy", () => {
    // scipy.stats.chi2.sf((|30−12|−1)²/42, 1)
    const big = mcnemarTest(30, 12);
    expect(big.exact).toBe(false);
    expect(big.stat!).toBeCloseTo(6.880952380952381, 10);
    expect(big.pValue).toBeCloseTo(0.008711912962379598, 8);
    // scipy.stats.binomtest(1, 8, 0.5).pvalue
    const small = mcnemarTest(7, 1);
    expect(small.exact).toBe(true);
    expect(small.pValue).toBeCloseTo(0.0703125, 12);
    expect(mcnemarTest(0, 0).pValue).toBe(1);
  });

  it("AUC = peluang skor positif > negatif (seri ½)", () => {
    expect(aucScore([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8], 1)).toBeCloseTo(0.75, 12);
    expect(aucScore([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5], 1)).toBeCloseTo(0.5, 12);
  });

  it("confusion matrix, precision/recall/F1, balanced accuracy", () => {
    // aktual: 4×A, 2×B; prediksi: A A A B | B A
    const e = evaluate([0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 1, 0], 2, ["A", "B"]);
    expect(e.confusion).toEqual([
      [3, 1],
      [1, 1],
    ]);
    expect(e.accuracy).toBeCloseTo(4 / 6, 12);
    expect(e.perClass[0].precision).toBeCloseTo(3 / 4, 12);
    expect(e.perClass[0].recall).toBeCloseTo(3 / 4, 12);
    expect(e.perClass[1].recall).toBeCloseTo(1 / 2, 12);
    expect(e.balancedAccuracy).toBeCloseTo((3 / 4 + 1 / 2) / 2, 12);
  });

  it("split stratified menjaga proporsi kelas & deterministik", () => {
    const y = [...new Array(80).fill(0), ...new Array(20).fill(1)];
    const a = stratifiedSplit(y, 0.3, 42);
    expect(a.test.filter((i) => y[i] === 1).length).toBe(6);
    expect(a.test.filter((i) => y[i] === 0).length).toBe(24);
    expect(stratifiedSplit(y, 0.3, 42)).toEqual(a);
  });
});

describe("Decision Tree & Naive Bayes", () => {
  it("batas numerik yang jelas → pohon menemukan ambangnya", () => {
    const rows: ParsedRow[] = Array.from({ length: 200 }, (_, i) => ({ skor: i % 100, kota: ["A", "B"][i % 2], hasil: i % 100 < 50 ? "gagal" : "lulus" }));
    const { profiles } = table(rows);
    const r = ok(classifyTable(rows, profiles, "hasil"));
    expect(r.tree.accuracy).toBe(1);
    expect(r.tree.importance[0]).toEqual({ feature: "skor", value: 1 });
    expect(r.tree.rules.some((rule) => /skor ≤ 49/.test(rule.conditions.join(" ")))).toBe(true);
    expect(r.notes.join(" ")).toMatch(/kebocoran data/); // akurasi 100% → peringatan leakage
  });

  it("fitur kategorikal yang menentukan kelas", () => {
    const rand = mulberry32(3);
    const rows: ParsedRow[] = Array.from({ length: 300 }, () => {
      const paket = ["Basic", "Pro", "Premium"][Math.floor(rand() * 3)];
      const churn = paket === "Basic" ? rand() < 0.8 : rand() < 0.1;
      return { paket, usia: Math.round(20 + rand() * 40), churn: churn ? "Ya" : "Tidak" };
    });
    const { profiles } = table(rows);
    const r = ok(classifyTable(rows, profiles, "churn"));
    expect(r.tree.importance[0].feature).toBe("paket");
    expect(r.tree.balancedAccuracy).toBeGreaterThan(0.7);
    expect(r.tree.rules[0].conditions.join(" ")).toMatch(/paket/);
  });

  it("Naive Bayes Gaussian: posterior sama dengan rumus pdf normal langsung", () => {
    const rand = mulberry32(9);
    const nrm = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
    const rows: ParsedRow[] = Array.from({ length: 200 }, (_, i) => {
      const k = i % 2;
      return { x: +(k ? 3 + nrm() : nrm()).toFixed(4), kelas: k ? "B" : "A" };
    });
    const { profiles } = table(rows);
    const r = ok(classifyTable(rows, profiles, "kelas"));
    // Dua Gaussian berjarak 3σ → Naive Bayes ~ optimal Bayes (≈ 93%).
    expect(r.naiveBayes.accuracy).toBeGreaterThan(0.85);
    expect(r.naiveBayes.auc!).toBeGreaterThan(0.9);
  });

  it("fitur acak → model tidak lebih baik dari baseline, dan dikatakan jujur", () => {
    const rand = mulberry32(21);
    const rows: ParsedRow[] = Array.from({ length: 300 }, () => ({ a: rand(), b: rand(), status: rand() < 0.5 ? "aktif" : "nonaktif" }));
    const { profiles } = table(rows);
    const r = ok(classifyTable(rows, profiles, "status"));
    expect(Math.max(r.tree.balancedAccuracy, r.naiveBayes.balancedAccuracy)).toBeLessThan(0.65);
    // Tak ada split yang membantu di CV → pohon kedalaman 0 (= tebak mayoritas), dipilih aturan 1-SE.
    expect(r.tree.depth).toBe(0);
    expect(r.tree.rules[0].conditions).toEqual([]);
    expect(r.best).toBe("baseline");
    expect(r.notes.join(" ")).toMatch(/tidak lebih baik dari menebak/);
  });

  it("kelas tidak seimbang diberi peringatan", () => {
    const rand = mulberry32(5);
    const rows: ParsedRow[] = Array.from({ length: 400 }, () => {
      const x = rand();
      return { x, fraud: x > 0.9 && rand() < 0.9 ? "ya" : "tidak" };
    });
    const { profiles } = table(rows);
    const r = ok(classifyTable(rows, profiles, "fraud"));
    expect(r.notes.join(" ")).toMatch(/tidak seimbang/);
    expect(r.positiveClass).toBe("ya");
  });
});

describe("integrasi analyzeFile", () => {
  it("churn: target otomatis, pohon mengalahkan baseline, faktor penentu benar; chat & insight", async () => {
    const t0 = performance.now();
    const r = await analyzeFile(new File([churnCsv()], "pelanggan-churn.csv"), "");
    const ms = performance.now() - t0;
    const cl = r.classification!;
    expect(cl.result?.target).toBe("churn");
    const res = cl.result!;
    expect(res.features.map((f) => f.name)).not.toContain("id_pelanggan");
    // Batas atas (Bayes) ≈ 0,76 karena 10% label noise; baseline = 0,50.
    expect(res.tree.balancedAccuracy).toBeGreaterThan(res.baseline.balancedAccuracy + 0.2);
    expect(res.tree.importance.slice(0, 2).map((f) => f.feature).sort()).toEqual(["keluhan", "lama_langganan_bulan"]);
    expect(res.best).not.toBe("baseline");
    expect(ms).toBeLessThan(5000);
    // Aturan pembangkit data ditemukan; daun bersaudara berprediksi sama digabung (tidak ada aturan "tagihan").
    expect(res.tree.rules.some((x) => x.prediction === "Ya" && /lama_langganan_bulan ≤ 12/.test(x.conditions.join()) && /keluhan > 2/.test(x.conditions.join()))).toBe(true);
    expect(res.tree.rules.every((x) => !x.conditions.join().includes("tagihan"))).toBe(true);

    const ans = answerQuery("apa faktor penentu churn?", r);
    expect(ans.text).toMatch(/balanced accuracy/);
    expect(ans.text).toMatch(/keluhan|lama_langganan_bulan/);
    expect(answerQuery("tunjukkan hasil klasifikasi", r).text).toMatch(/McNemar/);
    expect(r.insights.some((i) => i.title.startsWith("Faktor penentu churn"))).toBe(true);
  });

  it("dataset tanpa target jelas: tidak menebak, tapi kandidat ditawarkan", async () => {
    const csv = ["kota,omzet,biaya", ...Array.from({ length: 60 }, (_, i) => `${["A", "B", "C"][i % 3]},${100 + i},${50 + (i % 7)}`)].join("\n");
    const r = await analyzeFile(new File([csv], "toko.csv"), "");
    expect(r.classification?.result).toBeNull();
    expect(r.classification?.candidates).toEqual(["kota"]);
    expect(answerQuery("klasifikasi", r).text).toMatch(/kota/);
  });
});

describe("pemilihan target", () => {
  const intent = (focus: string[]): ParsedIntent => ({
    raw: "",
    tags: new Set(),
    focusColumns: focus,
    focusValues: [],
    focusValueColumns: [],
    topN: null,
    primaryFocus: focus[0] ?? null,
  });

  it("nama khas target dipilih otomatis; tanpa petunjuk tidak menebak", () => {
    const rows: ParsedRow[] = Array.from({ length: 50 }, (_, i) => ({ kota: ["A", "B", "C"][i % 3], churn: i % 2 ? "Ya" : "Tidak", umur: 20 + i }));
    const { profiles } = table(rows);
    expect(classTargetCandidates(profiles)).toEqual(["kota", "churn"]);
    expect(pickClassTarget(profiles, null)).toBe("churn");
    expect(pickClassTarget(profiles, intent(["kota"]))).toBe("kota");
    const noHint = profiles.filter((p) => p.name !== "churn");
    expect(pickClassTarget(noHint, null)).toBeNull();
  });

  it("terlalu sedikit baris → alasan", () => {
    const rows: ParsedRow[] = Array.from({ length: 20 }, (_, i) => ({ x: i, status: i % 2 ? "a" : "b" }));
    const { profiles } = table(rows);
    expect("reason" in classifyTable(rows, profiles, "status")).toBe(true);
  });
});
