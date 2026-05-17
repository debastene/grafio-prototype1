/**
 * Serialize cleaned rows back to CSV/TSV/JSON/JSONL with optional column rename.
 * Used by the wizard "Download Cleaned Data" feature.
 */

import { ParsedRow } from "./parse";
import { CleaningPlan, CleaningResult } from "./clean";

export type DownloadFormat = "csv" | "tsv" | "json" | "jsonl";

export type ColumnRename = {
  /** original column name */
  original: string;
  /** AI-suggested friendly name */
  suggested: string;
  /** which one user wants in the output */
  use: "original" | "suggested";
  /** short reason from AI (optional, for UI) */
  reason?: string;
};

const NEEDS_QUOTE = /[",\n\r]/;

function csvCell(v: unknown, delim: string): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (s.includes(delim) || NEEDS_QUOTE.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renameMap(renames: ColumnRename[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of renames) {
    m.set(r.original, r.use === "suggested" ? r.suggested : r.original);
  }
  return m;
}

export function serializeRows(
  headers: string[],
  rows: ParsedRow[],
  format: DownloadFormat,
  renames: ColumnRename[] = [],
): string {
  const map = renameMap(renames);
  const outHeaders = headers.map((h) => map.get(h) ?? h);

  if (format === "json") {
    const out = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const h of headers) o[map.get(h) ?? h] = r[h] ?? null;
      return o;
    });
    return JSON.stringify(out, null, 2);
  }
  if (format === "jsonl") {
    return rows
      .map((r) => {
        const o: Record<string, unknown> = {};
        for (const h of headers) o[map.get(h) ?? h] = r[h] ?? null;
        return JSON.stringify(o);
      })
      .join("\n");
  }
  const delim = format === "tsv" ? "\t" : ",";
  const lines: string[] = [];
  lines.push(outHeaders.map((h) => csvCell(h, delim)).join(delim));
  for (const r of rows) {
    lines.push(headers.map((h) => csvCell(r[h], delim)).join(delim));
  }
  return lines.join("\n");
}

export function extensionFor(format: DownloadFormat): string {
  switch (format) {
    case "csv":
      return "csv";
    case "tsv":
      return "tsv";
    case "json":
      return "json";
    case "jsonl":
      return "jsonl";
  }
}

export function mimeFor(format: DownloadFormat): string {
  switch (format) {
    case "csv":
      return "text/csv;charset=utf-8";
    case "tsv":
      return "text/tab-separated-values;charset=utf-8";
    case "json":
      return "application/json;charset=utf-8";
    case "jsonl":
      return "application/x-ndjson;charset=utf-8";
  }
}

/**
 * Detect default download format from uploaded file extension.
 */
export function defaultFormatFromFilename(name: string): DownloadFormat {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "tsv") return "tsv";
  if (ext === "json") return "json";
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  return "csv";
}

/**
 * Generate a human-readable cleaning report (Markdown) summarizing
 * what Grafio did to the data.
 */
export function buildCleaningNotes(args: {
  fileName: string;
  originalRowCount: number;
  originalColCount: number;
  cleanedRowCount: number;
  cleanedColCount: number;
  plan: CleaningPlan;
  result: Pick<CleaningResult, "removedRows" | "removedColumns" | "imputedCells" | "cappedCells">;
  renames: ColumnRename[];
  numberFormat: "id" | "en";
  domain: string;
}): string {
  const dt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const renameSection =
    args.renames.filter((r) => r.use === "suggested" && r.original !== r.suggested).length === 0
      ? "_Tidak ada kolom yang di-rename._"
      : args.renames
          .filter((r) => r.use === "suggested" && r.original !== r.suggested)
          .map((r) => `- \`${r.original}\` → \`${r.suggested}\`${r.reason ? `  _(${r.reason})_` : ""}`)
          .join("\n");

  const ops: string[] = [];
  if (args.plan.dropDuplicates) ops.push(`- Buang baris duplikat`);
  if (args.plan.dropEmptyColumns) ops.push(`- Buang kolom 100% kosong`);
  if (args.plan.dropConstantColumns) ops.push(`- Buang kolom konstan`);
  if (args.plan.imputeMissing === "mean_median")
    ops.push(`- Isi nilai kosong (median untuk angka, modus untuk kategori)`);
  if (args.plan.imputeMissing === "drop_rows") ops.push(`- Hapus baris yang punya nilai kosong`);
  if (args.plan.capOutliers) ops.push(`- Cap outlier ke fence 1.5×IQR`);
  if (args.plan.excludeColumns && args.plan.excludeColumns.length > 0) {
    ops.push(`- Kolom dikecualikan dari cleaning: ${args.plan.excludeColumns.join(", ")}`);
  }

  return `# Catatan Cleaning — Grafio

**File asal:** ${args.fileName}
**Domain terdeteksi:** ${args.domain}
**Format angka:** ${args.numberFormat.toUpperCase()}
**Dibersihkan pada:** ${dt}

## Ringkasan Perubahan

| Metric | Sebelum | Sesudah |
|---|---|---|
| Total baris | ${args.originalRowCount.toLocaleString("id")} | ${args.cleanedRowCount.toLocaleString("id")} |
| Total kolom | ${args.originalColCount} | ${args.cleanedColCount} |
| Sel kosong diisi | — | ${args.result.imputedCells.toLocaleString("id")} |
| Outlier di-cap | — | ${args.result.cappedCells.toLocaleString("id")} |
| Baris dihapus | — | ${args.result.removedRows.toLocaleString("id")} |
| Kolom dibuang | — | ${args.result.removedColumns.length} |

## Operasi yang Dijalankan

${ops.length > 0 ? ops.join("\n") : "_Tidak ada operasi cleaning yang diaktifkan._"}

${args.result.removedColumns.length > 0
  ? `### Kolom yang Dibuang\n${args.result.removedColumns.map((c) => `- \`${c}\``).join("\n")}\n`
  : ""}

## Rename Kolom (oleh AI Grafio)

${renameSection}

---

_Catatan ini dibuat otomatis oleh Grafio Engine. File data hasil cleaning sudah disertakan dalam download yang sama._
`;
}

/**
 * Trigger browser download for text content.
 */
export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
