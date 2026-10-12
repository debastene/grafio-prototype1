import { describe, it, expect } from "vitest";
import { detectIssues, applyCleaning, computeHealthScore, recommendPlan, DEFAULT_PLAN, type CleaningPlan } from "../clean";
import { profileTable } from "../profile";
import type { ParsedRow } from "../parse";

/** Helper: bikin rows + profile sekaligus. */
function prep(rows: ParsedRow[], headers?: string[]) {
  const h = headers ?? Object.keys(rows[0] ?? {});
  const profiles = profileTable(h, rows);
  return { headers: h, rows, profiles };
}

describe("detectIssues", () => {
  it("kolom 100% null → empty_column", () => {
    const { profiles, rows } = prep([
      { a: 1, b: null },
      { a: 2, b: null },
    ]);
    const issues = detectIssues(profiles, rows);
    expect(issues).toContainEqual({ kind: "empty_column", column: "b" });
  });

  it("kolom konstan → constant_column", () => {
    const { profiles, rows } = prep([
      { a: 1, status: "aktif" },
      { a: 2, status: "aktif" },
      { a: 3, status: "aktif" },
    ]);
    const issues = detectIssues(profiles, rows);
    expect(issues.some((i) => i.kind === "constant_column" && i.column === "status")).toBe(true);
  });

  it("missing ≥5% → issue missing dengan severity sesuai pct", () => {
    // 5 dari 10 null → 50% → high
    const rows: ParsedRow[] = Array.from({ length: 10 }, (_, i) => ({
      a: i,
      b: i < 5 ? null : i,
    }));
    const { profiles } = prep(rows);
    const issues = detectIssues(profiles, rows);
    const missing = issues.find((i) => i.kind === "missing" && i.column === "b");
    expect(missing).toBeDefined();
    expect(missing && missing.kind === "missing" && missing.severity).toBe("high");
  });

  it("duplicate rows terdeteksi + dihitung", () => {
    const rows: ParsedRow[] = [
      { a: 1, b: "x" },
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ];
    const { profiles } = prep(rows);
    const issues = detectIssues(profiles, rows);
    const dup = issues.find((i) => i.kind === "duplicate_rows");
    expect(dup).toBeDefined();
    expect(dup && dup.kind === "duplicate_rows" && dup.count).toBe(1);
  });

  it("data bersih → tidak ada issue duplicate/empty/missing", () => {
    const rows: ParsedRow[] = [
      { a: 1, b: "x" },
      { a: 2, b: "y" },
      { a: 3, b: "z" },
    ];
    const { profiles } = prep(rows);
    const issues = detectIssues(profiles, rows);
    expect(issues.filter((i) => ["duplicate_rows", "empty_column", "missing"].includes(i.kind))).toEqual([]);
  });
});

describe("applyCleaning", () => {
  it("dropEmptyColumns buang kolom full-null", () => {
    const { headers, rows, profiles } = prep([
      { a: 1, kosong: null },
      { a: 2, kosong: null },
    ]);
    const res = applyCleaning(headers, rows, profiles, { ...DEFAULT_PLAN });
    expect(res.headers).toEqual(["a"]);
    expect(res.removedColumns).toEqual(["kosong"]);
    expect(res.rows[0]).not.toHaveProperty("kosong");
  });

  it("dropDuplicates dedup + hitung removedRows", () => {
    const { headers, rows, profiles } = prep([
      { a: 1 },
      { a: 1 },
      { a: 1 },
      { a: 2 },
    ]);
    const res = applyCleaning(headers, rows, profiles, { ...DEFAULT_PLAN, dropDuplicates: true });
    expect(res.rows).toHaveLength(2);
    expect(res.removedRows).toBe(2);
  });

  it("imputeMissing mean_median: numeric diisi median, categorical diisi mode", () => {
    const rows: ParsedRow[] = [
      { n: 10, c: "a" },
      { n: 20, c: "a" },
      { n: 30, c: "b" },
      { n: null, c: null },
      { n: 40, c: "a" },
      { n: 50, c: "b" },
    ];
    const { headers, profiles } = prep(rows);
    const plan: CleaningPlan = { ...DEFAULT_PLAN, dropDuplicates: false, imputeMissing: "mean_median" };
    const res = applyCleaning(headers, rows, profiles, plan);
    // median dari [10,20,30,40,50] = 30
    expect(res.rows[3].n).toBe(30);
    // mode dari c = "a" (3×)
    expect(res.rows[3].c).toBe("a");
    expect(res.imputedCells).toBe(2);
  });

  it("imputeMissing drop_rows buang baris yang punya null", () => {
    const rows: ParsedRow[] = [
      { a: 1, b: "x" },
      { a: null, b: "y" },
      { a: 3, b: null },
      { a: 4, b: "z" },
    ];
    const { headers, profiles } = prep(rows);
    const plan: CleaningPlan = { ...DEFAULT_PLAN, dropDuplicates: false, imputeMissing: "drop_rows" };
    const res = applyCleaning(headers, rows, profiles, plan);
    expect(res.rows).toHaveLength(2);
    expect(res.removedRows).toBe(2);
  });

  it("capOutliers memotong nilai ekstrem ke IQR fence (bukan drop row)", () => {
    const rows: ParsedRow[] = [1, 2, 3, 4, 5, 100].map((v) => ({ v }));
    const { headers, profiles } = prep(rows);
    const plan: CleaningPlan = { ...DEFAULT_PLAN, dropDuplicates: false, capOutliers: true };
    const res = applyCleaning(headers, rows, profiles, plan);
    expect(res.rows).toHaveLength(6); // tidak ada row dibuang
    expect(res.cappedCells).toBeGreaterThanOrEqual(1);
    const last = res.rows[5].v as number;
    expect(last).toBeLessThan(100); // 100 dipotong ke upper fence
  });

  it("excludeColumns: kolom yang dikecualikan tidak disentuh", () => {
    const rows: ParsedRow[] = [
      { n: 10 },
      { n: null },
      { n: 30 },
      { n: 40 },
      { n: 20 },
    ];
    const { headers, profiles } = prep(rows);
    const plan: CleaningPlan = {
      ...DEFAULT_PLAN,
      dropDuplicates: false,
      imputeMissing: "mean_median",
      excludeColumns: ["n"],
    };
    const res = applyCleaning(headers, rows, profiles, plan);
    expect(res.rows[1].n).toBeNull(); // tetap null — di-exclude
    expect(res.imputedCells).toBe(0);
  });

  it("tidak memutasi rows input", () => {
    const rows: ParsedRow[] = [{ a: 1 }, { a: 1 }];
    const { headers, profiles } = prep(rows);
    applyCleaning(headers, rows, profiles, { ...DEFAULT_PLAN, dropDuplicates: true });
    expect(rows).toHaveLength(2);
  });
});

describe("computeHealthScore", () => {
  it("tanpa issue → 100", () => {
    expect(computeHealthScore([], [])).toBe(100);
  });

  it("issue menurunkan skor, tidak pernah di bawah 0", () => {
    const manyIssues = Array.from({ length: 20 }, () => ({
      kind: "duplicate_rows" as const,
      count: 100,
      severity: "high" as const,
    }));
    const score = computeHealthScore([], manyIssues);
    expect(score).toBe(0);
  });

  it("severity lebih tinggi = penalti lebih besar", () => {
    const low = computeHealthScore([], [{ kind: "missing", column: "a", count: 1, pct: 0.05, severity: "low" }]);
    const high = computeHealthScore([], [{ kind: "missing", column: "a", count: 9, pct: 0.9, severity: "high" }]);
    expect(high).toBeLessThan(low);
  });
});

describe("recommendPlan", () => {
  it("ada missing → imputeMissing mean_median; outlier TIDAK otomatis di-cap (bisa data sah)", () => {
    const plan = recommendPlan([
      { kind: "missing", column: "a", count: 3, pct: 0.3, severity: "medium" },
      { kind: "outliers", column: "b", count: 2, severity: "mild" },
    ]);
    expect(plan.imputeMissing).toBe("mean_median");
    // REGRESI UJI-BROWSER: populasi India (1,37 M) dulu di-cap jadi 241 jt → Σ populasi salah.
    expect(plan.capOutliers).toBe(false);
  });

  it("tidak ada issue → plan konservatif (no dedup, no impute)", () => {
    const plan = recommendPlan([]);
    expect(plan.imputeMissing).toBe("none");
    expect(plan.capOutliers).toBe(false);
    expect(plan.dropDuplicates).toBe(false);
  });
});
