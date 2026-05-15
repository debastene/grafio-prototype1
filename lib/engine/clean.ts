/**
 * Data cleaning detector + transformer.
 *
 * Detects issues in the parsed table:
 *   - missing values per column
 *   - exact duplicate rows
 *   - empty / constant columns
 *   - extreme outliers
 *   - high-cardinality text in categorical columns
 *
 * Applies user-approved cleaning operations and returns the cleaned rows
 * along with a summary of changes.
 */

import { ColProfile } from "./profile";
import { ParsedRow } from "./parse";
import { clean as cleanArr, summarize } from "./stats";

export type CleaningIssue =
  | { kind: "missing"; column: string; count: number; pct: number; severity: "low" | "medium" | "high" }
  | { kind: "duplicate_rows"; count: number; severity: "low" | "medium" | "high" }
  | { kind: "empty_column"; column: string }
  | { kind: "constant_column"; column: string; value: string }
  | { kind: "outliers"; column: string; count: number; severity: "mild" | "extreme" }
  | { kind: "high_cardinality"; column: string; unique: number };

export type CleaningPlan = {
  /** Drop columns that are 100% null */
  dropEmptyColumns: boolean;
  /** Drop columns where all non-null values are identical */
  dropConstantColumns: boolean;
  /** Drop exact duplicate rows */
  dropDuplicates: boolean;
  /** Per-column missing-value imputation */
  imputeMissing: "none" | "mean_median" | "drop_rows";
  /** Cap outliers at 1.5×IQR fences (no row drop) */
  capOutliers: boolean;
};

export const DEFAULT_PLAN: CleaningPlan = {
  dropEmptyColumns: true,
  dropConstantColumns: false,
  dropDuplicates: true,
  imputeMissing: "none",
  capOutliers: false,
};

export type CleaningResult = {
  rows: ParsedRow[];
  headers: string[];
  removedRows: number;
  removedColumns: string[];
  imputedCells: number;
  cappedCells: number;
};

/**
 * Detect issues from profiled data.
 */
export function detectIssues(profiles: ColProfile[], rows: ParsedRow[]): CleaningIssue[] {
  const issues: CleaningIssue[] = [];

  for (const p of profiles) {
    if (p.total === 0) continue;
    if (p.missing === p.total) {
      issues.push({ kind: "empty_column", column: p.name });
      continue;
    }
    if (p.unique === 1) {
      const val = p.topValues?.[0]?.value ?? "—";
      issues.push({ kind: "constant_column", column: p.name, value: String(val) });
    }
    if (p.missingPct > 0) {
      const sev = p.missingPct >= 0.5 ? "high" : p.missingPct >= 0.2 ? "medium" : "low";
      if (p.missingPct >= 0.05) {
        issues.push({
          kind: "missing",
          column: p.name,
          count: p.missing,
          pct: p.missingPct,
          severity: sev,
        });
      }
    }
    if (p.outlierCount && p.outlierCount > 0) {
      issues.push({
        kind: "outliers",
        column: p.name,
        count: p.outlierCount,
        severity: p.outlierCount > Math.max(5, p.total * 0.05) ? "extreme" : "mild",
      });
    }
    if (
      (p.type === "categorical" || p.type === "text") &&
      !p.isLikelyId &&
      p.uniqueRatio > 0.7 &&
      p.unique > 50
    ) {
      issues.push({ kind: "high_cardinality", column: p.name, unique: p.unique });
    }
  }

  // Duplicate detection (cap at first 10000 rows)
  const seen = new Set<string>();
  let dupes = 0;
  const cap = Math.min(rows.length, 10000);
  for (let i = 0; i < cap; i++) {
    const r = rows[i];
    const key = JSON.stringify(r);
    if (seen.has(key)) dupes++;
    else seen.add(key);
  }
  if (dupes > 0) {
    const sev = dupes > rows.length * 0.05 ? "high" : dupes > 5 ? "medium" : "low";
    issues.push({ kind: "duplicate_rows", count: dupes, severity: sev });
  }

  return issues;
}

/**
 * Apply the cleaning plan to the table.
 */
export function applyCleaning(
  headers: string[],
  rows: ParsedRow[],
  profiles: ColProfile[],
  plan: CleaningPlan,
): CleaningResult {
  let workingHeaders = [...headers];
  let workingRows = rows.map((r) => ({ ...r }));
  let imputedCells = 0;
  let cappedCells = 0;
  const removedColumns: string[] = [];
  let removedRows = 0;

  // 1. Drop empty / constant columns
  if (plan.dropEmptyColumns || plan.dropConstantColumns) {
    const toDrop = new Set<string>();
    for (const p of profiles) {
      if (plan.dropEmptyColumns && p.missing === p.total) toDrop.add(p.name);
      if (plan.dropConstantColumns && p.unique === 1 && p.total > 0) toDrop.add(p.name);
    }
    for (const col of toDrop) removedColumns.push(col);
    workingHeaders = workingHeaders.filter((h) => !toDrop.has(h));
    workingRows = workingRows.map((r) => {
      const out: ParsedRow = {};
      for (const h of workingHeaders) out[h] = r[h];
      return out;
    });
  }

  // 2. Drop duplicate rows
  if (plan.dropDuplicates) {
    const seen = new Set<string>();
    const filtered: ParsedRow[] = [];
    for (const r of workingRows) {
      const key = JSON.stringify(r);
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(r);
      } else {
        removedRows++;
      }
    }
    workingRows = filtered;
  }

  // 3. Impute missing values (mean for numeric, mode for categorical)
  if (plan.imputeMissing === "mean_median") {
    for (const p of profiles) {
      if (!workingHeaders.includes(p.name)) continue;
      if (p.summary && p.summary.count > 0) {
        const replacement = p.summary.median;
        for (const r of workingRows) {
          const v = r[p.name];
          if (v === null || v === undefined || v === "") {
            r[p.name] = replacement;
            imputedCells++;
          }
        }
      } else if (p.topValues && p.topValues.length > 0) {
        const mode = p.topValues[0].value;
        for (const r of workingRows) {
          const v = r[p.name];
          if (v === null || v === undefined || v === "") {
            r[p.name] = mode;
            imputedCells++;
          }
        }
      }
    }
  } else if (plan.imputeMissing === "drop_rows") {
    const before = workingRows.length;
    workingRows = workingRows.filter((r) => {
      for (const h of workingHeaders) {
        const v = r[h];
        if (v === null || v === undefined || v === "") return false;
      }
      return true;
    });
    removedRows += before - workingRows.length;
  }

  // 4. Cap outliers
  if (plan.capOutliers) {
    for (const p of profiles) {
      if (!workingHeaders.includes(p.name)) continue;
      if (!p.numericVector || !p.summary) continue;
      const cleanedVec = cleanArr(p.numericVector);
      if (cleanedVec.length < 5) continue;
      const s = summarize(cleanedVec);
      const lo = s.q1 - 1.5 * s.iqr;
      const hi = s.q3 + 1.5 * s.iqr;
      for (const r of workingRows) {
        const v = r[p.name];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < lo) {
            r[p.name] = lo;
            cappedCells++;
          } else if (v > hi) {
            r[p.name] = hi;
            cappedCells++;
          }
        }
      }
    }
  }

  return {
    rows: workingRows,
    headers: workingHeaders,
    removedRows,
    removedColumns,
    imputedCells,
    cappedCells,
  };
}

/**
 * Quick health score 0-100 based on issue density.
 */
export function computeHealthScore(profiles: ColProfile[], issues: CleaningIssue[]): number {
  let score = 100;
  for (const i of issues) {
    if (i.kind === "missing") {
      score -= i.severity === "high" ? 12 : i.severity === "medium" ? 6 : 2;
    } else if (i.kind === "duplicate_rows") {
      score -= i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3;
    } else if (i.kind === "empty_column") {
      score -= 5;
    } else if (i.kind === "constant_column") {
      score -= 3;
    } else if (i.kind === "outliers") {
      score -= i.severity === "extreme" ? 5 : 2;
    } else if (i.kind === "high_cardinality") {
      score -= 2;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
