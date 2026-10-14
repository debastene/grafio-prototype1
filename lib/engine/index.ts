/**
 * Grafio Engine — main entry point.
 *
 * Two-stage pipeline:
 *   1. quickInspect(file)  — fast: parse + detect format + profile + detect domain + cleaning issues
 *      Used to power the clarification step (user confirms before deep analysis).
 *   2. analyzeFile(file, prompt, options) — full: applies cleaning + format + intent → insights, charts.
 */

import { parseText, ParsedTable, ParsedRow } from "./parse";
import { profileTable, ColProfile } from "./profile";
import { analyzeTable, Analysis } from "./analyze";
import { generateInsights, generateKpis, generateSummary, generateConclusion, Insight, Kpi } from "./insights";
import { shapeCharts, ChartBundle } from "./charts";
import { computeMultivariate, MultivariateResult } from "./multivariate";
import { parseIntent, ParsedIntent } from "./intent";
import { detectDomain, Domain } from "./domain";
import { detectNumberFormat, applyNumberFormat, FormatDetection } from "./numberFormat";
import { detectIssues, applyCleaning, computeHealthScore, CleaningIssue, CleaningPlan, DEFAULT_PLAN } from "./clean";

/** Format yang BENAR-BENAR bisa diparse engine (teks). */
export const SUPPORTED_EXTENSIONS = ["csv", "tsv", "txt", "json", "jsonl", "ndjson"] as const;
const TEXT_EXTS = new Set<string>([...SUPPORTED_EXTENSIONS, "log"]);

/**
 * Batas ukuran file. Seluruh file dibaca & diparse di browser (tidak ada
 * pemotongan diam-diam) — file lebih besar ditolak dengan pesan jelas.
 * Dulu hanya 5 MB pertama yang dibaca sementara UI menjanjikan 50 MB:
 * hasilnya sampel "kepala file" yang bias, tanpa user tahu.
 */
// 5 MB ≈ 150 ribu baris: diparse ±3 detik & ±400 MB memori di browser. Lebih
// besar dari ini berisiko membuat tab crash di laptop/HP kelas menengah.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "5 MB";

export type ProgressFn = (stage: string) => void;

// ============================================================
// QUICK INSPECT — for the clarification step
// ============================================================

export type Inspection = {
  fileName: string;
  fileSize: number;
  format: "csv" | "tsv" | "json" | "jsonl" | "unknown";
  delimiter: string;
  headers: string[];
  rowCount: number;
  preview: { headers: string[]; rows: (string | number | boolean | null)[][] };

  numberFormat: FormatDetection;
  domain: Domain;
  profile: ColProfile[];
  issues: CleaningIssue[];
  healthScore: number;

  durationMs: number;
};

function assertFileAcceptable(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File ${mb} MB melebihi batas ${MAX_UPLOAD_LABEL}. Ambil sampel acak/stratified dulu (mis. di Excel/pandas) atau pecah per periode, lalu upload ulang.`,
    );
  }
}

async function readAsText(file: File): Promise<string> {
  assertFileAcceptable(file);
  return await file.text();
}

export async function quickInspect(
  file: File,
  options: { numberFormat?: "auto" | "id" | "en" } = {},
): Promise<Inspection> {
  const t0 = performance.now();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  if (!TEXT_EXTS.has(ext)) {
    throw new Error(
      `Format ${ext.toUpperCase() || "ini"} belum didukung. Grafio saat ini membaca ${SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} — ekspor ke CSV dulu (Excel: File → Save As → CSV).`,
    );
  }

  const text = await readAsText(file);
  const table = parseText(text, ext);
  if (table.rows.length === 0) {
    throw new Error("File kosong atau tidak terbaca. Pastikan format CSV/TSV/JSON valid.");
  }

  // Sample raw values for format detection
  const samples: (string | number | null)[] = [];
  const sampleN = Math.min(table.rows.length, 200);
  for (let i = 0; i < sampleN; i++) {
    for (const h of table.headers) {
      const v = table.rows[i][h];
      if (typeof v === "string" || typeof v === "number" || v === null) {
        samples.push(v);
      }
    }
  }
  const detectedFormat = detectNumberFormat(samples);

  // Apply chosen format
  const useFormat = options.numberFormat && options.numberFormat !== "auto"
    ? options.numberFormat
    : detectedFormat.format;
  const formattedRows = applyNumberFormat(table.rows, table.headers, useFormat);

  // Profile
  const profile = profileTable(table.headers, formattedRows);

  // Domain
  const domain = detectDomain(profile);

  // Cleaning issues
  const issues = detectIssues(profile, formattedRows);
  const healthScore = computeHealthScore(profile, issues);

  // Preview (first 10 rows of un-cleaned data, all columns)
  const previewRows = formattedRows.slice(0, 10).map((r) =>
    table.headers.map((h) => {
      const v = r[h];
      return v === null || v === undefined ? null : v;
    }),
  );

  return {
    fileName: file.name,
    fileSize: file.size,
    format: table.format,
    delimiter: table.delimiter,
    headers: table.headers,
    rowCount: table.rows.length,
    preview: { headers: table.headers, rows: previewRows },
    numberFormat: { ...detectedFormat, format: useFormat },
    domain,
    profile,
    issues,
    healthScore,
    durationMs: performance.now() - t0,
  };
}

// ============================================================
// FULL ANALYZE
// ============================================================

export type AnalyzeOptions = {
  numberFormat?: "auto" | "id" | "en";
  cleaningPlan?: CleaningPlan;
  inspection?: Inspection; // skip re-parse if already inspected
};

export type EngineResult = {
  summary: string;
  /** AI/engine's own takeaway about the dataset — plain language, opinionated. */
  conclusion: string;
  /** User-provided context note (from wizard step 3 confirmation), if any. */
  userContext?: string;
  insights: Insight[];
  kpis: Kpi[];
  recommendedCharts: string[];

  fileName: string;
  rowCount: number;
  columnCount: number;
  numericColCount: number;
  categoricalColCount: number;
  dateColCount: number;
  profile: ColProfile[];
  analysis: Analysis;
  charts: ChartBundle;
  promptApplied: string;
  intent: ParsedIntent | null;
  durationMs: number;

  // Context from clarification step
  domain: Domain;
  numberFormat: "id" | "en";
  cleaning: {
    plan: CleaningPlan;
    removedRows: number;
    removedColumns: string[];
    imputedCells: number;
    cappedCells: number;
    healthScoreBefore: number;
    healthScoreAfter: number;
  };

  tableSnapshot: {
    headers: string[];
    rows: ParsedRow[];
  };

  /**
   * AI-generated 1-3 kalimat insight per chart (poin #5 evaluasi 16 Mei).
   * Key = chart id (sesuai ChartFrame.id di dashboard), value = insight string.
   * Diisi async oleh AnalysisLauncher setelah engine selesai. Bisa kosong
   * kalau AI offline.
   */
  chartInsights?: Record<string, string>;

  /** PCA + klaster k-means (null kalau data tidak memenuhi syarat). Opsional: snapshot lama tidak punya. */
  multivariate?: MultivariateResult | null;

  /** Label engine/model yang dipakai — untuk badge di dashboard & PDF. */
  _meta?: {
    model?: string;
  };
};

export async function analyzeFile(
  file: File,
  prompt: string,
  options: AnalyzeOptions = {},
  onProgress?: ProgressFn,
): Promise<EngineResult> {
  const t0 = performance.now();

  // 1. INSPECT (or reuse)
  onProgress?.("Membaca & memprofil data…");
  const inspection = options.inspection ?? (await quickInspect(file, options));
  await microTick();

  // 2. APPLY CLEANING
  onProgress?.("Membersihkan data…");
  const plan = options.cleaningPlan ?? DEFAULT_PLAN;
  const useFormat = options.numberFormat && options.numberFormat !== "auto"
    ? options.numberFormat
    : inspection.numberFormat.format;

  // Re-read file to get fresh rows (since inspection profile is read-only)
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const text = await readAsText(file);
  const table = parseText(text, ext);
  const formattedRows = applyNumberFormat(table.rows, table.headers, useFormat);

  await microTick();
  const cleaned = applyCleaning(table.headers, formattedRows, inspection.profile, plan);
  await microTick();

  // 3. RE-PROFILE cleaned data
  onProgress?.("Mendeteksi tipe kolom (post-clean)…");
  const profiles = profileTable(cleaned.headers, cleaned.rows);
  const issuesAfter = detectIssues(profiles, cleaned.rows);
  const healthAfter = computeHealthScore(profiles, issuesAfter);

  // 4. INTENT
  onProgress?.("Memahami arahan Anda…");
  await microTick();
  const intent = parseIntent(prompt, profiles, cleaned.rows);

  // 5. ANALYZE
  onProgress?.("Menghitung statistik & korelasi…");
  await microTick();
  const analysis = analyzeTable(profiles, cleaned.rows, intent);

  // 6. INSIGHTS
  onProgress?.("Menyusun insight kontekstual…");
  await microTick();
  // Multivariat: kolom metrik berurut prioritas (primary dulu), maks 8.
  const mvCandidates = [
    ...analysis.primaryNumericCols,
    ...analysis.numericCols.filter((c) => !analysis.primaryNumericCols.includes(c)),
  ];
  const multivariate = computeMultivariate(profiles, mvCandidates);
  const insights = generateInsights(analysis, profiles, inspection.domain, multivariate);
  const kpis = generateKpis(analysis, profiles);
  const summary = generateSummary(analysis, profiles, file.name, inspection.domain);
  const conclusion = generateConclusion(analysis, profiles, inspection.domain);

  // 7. CHARTS
  onProgress?.("Membentuk visualisasi…");
  await microTick();
  const charts = shapeCharts(analysis, profiles, cleaned.rows, cleaned.headers);

  const durationMs = performance.now() - t0;

  return {
    summary,
    conclusion,
    insights,
    kpis,
    recommendedCharts: charts.recommended,
    fileName: file.name,
    rowCount: cleaned.rows.length,
    columnCount: cleaned.headers.length,
    numericColCount: analysis.numericCols.length,
    categoricalColCount: analysis.categoricalCols.length,
    dateColCount: analysis.dateCols.length,
    profile: profiles,
    analysis,
    charts,
    multivariate,
    promptApplied: prompt,
    intent,
    durationMs,
    domain: inspection.domain,
    numberFormat: useFormat,
    cleaning: {
      plan,
      removedRows: cleaned.removedRows,
      removedColumns: cleaned.removedColumns,
      imputedCells: cleaned.imputedCells,
      cappedCells: cleaned.cappedCells,
      healthScoreBefore: inspection.healthScore,
      healthScoreAfter: healthAfter,
    },
    tableSnapshot: {
      headers: cleaned.headers,
      rows: cleaned.rows.slice(0, 10000),
    },
    _meta: {
      model: "Grafio Engine v1.2",
    },
  };
}

function microTick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
