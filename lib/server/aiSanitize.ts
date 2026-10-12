/**
 * Validasi + sanitasi payload route AI.
 *
 * Tujuan:
 *   - Tolak bentuk payload yang salah (dulu → TypeError 500 + kuota terpotong).
 *   - Potong panjang string & jumlah elemen supaya satu request tidak bisa
 *     membawa ratusan ribu token ke provider AI.
 *   - Buang role "system" dari riwayat chat (dulu client bisa menyuntik
 *     instruksi system sendiri).
 *   - Samarkan PII (defense-in-depth; klien juga sudah menyamarkan).
 *
 * Semua fungsi return null kalau payload tidak valid.
 */

import type { ChatMsg } from "@/lib/openrouter";
import { maskArrayRow, maskRecord, maskText, maskTopValues } from "@/lib/privacy/pii";

type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

/** Teks bebas dari user → potong + samarkan pola PII. */
export function userText(v: unknown, max: number): string | undefined {
  const s = str(v, max);
  return s === undefined ? undefined : maskText(s);
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

/** Nilai sel sampel: primitif dipertahankan (string dipotong), lainnya dibuang. */
function cell(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.slice(0, 120);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  return null;
}

function sampleRecords(v: unknown, maxRows: number, maxCols = 40): Obj[] {
  return arr(v, maxRows)
    .filter(isObj)
    .map((r) => {
      const out: Obj = {};
      for (const [k, val] of Object.entries(r).slice(0, maxCols)) out[k.slice(0, 80)] = cell(val);
      return maskRecord(out);
    });
}

function sampleArrays(v: unknown, headers: string[], maxRows: number): unknown[][] {
  return arr(v, maxRows)
    .filter(Array.isArray)
    .map((r) => maskArrayRow((r as unknown[]).slice(0, headers.length || 100).map(cell), headers));
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  return arr(v, maxItems).filter((x): x is string => typeof x === "string").map((s) => s.slice(0, maxLen));
}

// ============================================================
// CHAT
// ============================================================

export const MAX_CHAT_MESSAGES = 20;
export const MAX_CHAT_CHARS = 2_000;

/**
 * Hanya role user/assistant, maks 20 pesan terakhir, tiap pesan maks 2.000
 * karakter. Pesan terakhir wajib dari user.
 */
export function sanitizeChatMessages(v: unknown): ChatMsg[] | null {
  if (!Array.isArray(v)) return null;
  const msgs: ChatMsg[] = v
    .filter(isObj)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: maskText((m.content as string).slice(0, MAX_CHAT_CHARS)),
    }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_CHAT_MESSAGES);
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

export type ChatDataset = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  domain?: string;
  userContext?: string;
  conclusion?: string;
  columns: {
    name: string;
    type: string;
    nulls?: number;
    mean?: number;
    median?: number;
    min?: number | string;
    max?: number | string;
    topValues?: { value: string; count: number }[];
  }[];
  sample?: Obj[];
  insights?: { type: string; title: string; body: string }[];
};

export function sanitizeChatDataset(v: unknown): ChatDataset | null {
  if (!isObj(v)) return null;
  const columns = arr(v.columns, 30)
    .filter(isObj)
    .map((c) => {
      const name = str(c.name, 100) ?? "";
      const topValues = arr(c.topValues, 3)
        .filter(isObj)
        .map((t) => ({ value: String(cell(t.value) ?? ""), count: num(t.count) ?? 0 }));
      const minMax = (x: unknown) => num(x) ?? str(x, 40);
      return {
        name,
        type: str(c.type, 20) ?? "unknown",
        nulls: num(c.nulls),
        mean: num(c.mean),
        median: num(c.median),
        min: minMax(c.min),
        max: minMax(c.max),
        topValues: maskTopValues(name, topValues),
      };
    })
    .filter((c) => c.name.length > 0);
  return {
    fileName: str(v.fileName, 200) ?? "dataset",
    rowCount: num(v.rowCount) ?? 0,
    columnCount: num(v.columnCount) ?? columns.length,
    domain: str(v.domain, 300),
    userContext: userText(v.userContext, 1_000),
    conclusion: str(v.conclusion, 1_500),
    columns,
    sample: sampleRecords(v.sample, 5),
    insights: arr(v.insights, 4)
      .filter(isObj)
      .map((i) => ({ type: str(i.type, 20) ?? "idea", title: str(i.title, 120) ?? "", body: str(i.body, 400) ?? "" })),
  };
}

// ============================================================
// EXPLAIN — per mode
// ============================================================

export type ExplainMode = "clarify" | "narrate" | "chart" | "followup" | "report" | "rename" | "chart-insights";
export const EXPLAIN_MODES: ExplainMode[] = ["clarify", "narrate", "chart", "followup", "report", "rename", "chart-insights"];

function chartData(v: unknown): (number | { x: number; y: number; r?: number })[] {
  return arr(v, 12)
    .map((d) => {
      if (typeof d === "number") return Number.isFinite(d) ? d : null;
      if (isObj(d) && num(d.x) !== undefined && num(d.y) !== undefined) {
        return { x: num(d.x)!, y: num(d.y)!, ...(num(d.r) !== undefined ? { r: num(d.r) } : {}) };
      }
      return null;
    })
    .filter((d): d is number | { x: number; y: number; r?: number } => d !== null);
}

function datasets(v: unknown) {
  return arr(v, 6)
    .filter(isObj)
    .map((d) => ({ label: maskText(str(d.label, 120) ?? ""), data: chartData(d.data) }));
}

function labels(v: unknown): string[] {
  return arr(v, 12).map((l) => maskText(String(cell(l) ?? "")).slice(0, 80));
}

const trendList = (v: unknown, max: number) =>
  arr(v, max)
    .filter(isObj)
    .map((t) => ({
      column: str(t.column, 100) ?? "",
      direction: str(t.direction, 10) ?? "datar",
      pctChange: num(t.pctChange) ?? 0,
      r2: num(t.r2) ?? 0,
      startValue: num(t.startValue) ?? 0,
      endValue: num(t.endValue) ?? 0,
      pValue: num(t.pValue),
      significant: typeof t.significant === "boolean" ? t.significant : undefined,
    }));

const corrList = (v: unknown, max: number) =>
  arr(v, max)
    .filter(isObj)
    .map((c) => ({
      a: str(c.a, 100) ?? "",
      b: str(c.b, 100) ?? "",
      r: num(c.r) ?? 0,
      direction: str(c.direction, 10) ?? "",
      strength: str(c.strength, 20) ?? "",
    }));

const anomalyList = (v: unknown, max: number) =>
  arr(v, max)
    .filter(isObj)
    .map((a) => ({ column: str(a.column, 100) ?? "", count: num(a.count) ?? 0, topZscore: num(a.topZscore) }));

const kpiList = (v: unknown) =>
  arr(v, 6)
    .filter(isObj)
    .map((k) => ({ label: str(k.label, 60) ?? "", value: str(k.value, 60) ?? "", change: num(k.change) ?? null }));

const columnStats = (v: unknown, max: number) =>
  arr(v, max)
    .filter(isObj)
    .map((c) => ({
      name: str(c.name, 100) ?? "",
      type: str(c.type, 20) ?? "unknown",
      mean: num(c.mean),
      min: num(c.min),
      max: num(c.max),
    }));

/**
 * Sanitasi body /api/explain sesuai mode. Return body bersih (bentuk sama
 * dengan yang diharapkan handler) atau null kalau field wajib tidak ada.
 */
export function sanitizeExplainBody(mode: ExplainMode, body: Obj): Obj | null {
  switch (mode) {
    case "clarify": {
      const i = body.inspection;
      if (!isObj(i) || !isObj(i.domain) || !isObj(i.preview) || !Array.isArray(i.profile)) return null;
      const headers = strList(i.headers, 100, 100);
      const previewHeaders = strList(i.preview.headers, 100, 100);
      return {
        inspection: {
          fileName: str(i.fileName, 200) ?? "dataset",
          rowCount: num(i.rowCount) ?? 0,
          headers,
          domain: { name: str(i.domain.name, 100) ?? "Generic", description: str(i.domain.description, 300) ?? "" },
          preview: { rows: sampleArrays(i.preview.rows, previewHeaders.length ? previewHeaders : headers, 5) },
          profile: arr(i.profile, 30)
            .filter(isObj)
            .map((p) => ({ name: str(p.name, 100) ?? "", type: str(p.type, 20) ?? "", missingPct: num(p.missingPct) ?? 0 })),
        },
      };
    }
    case "narrate": {
      const c = body.context;
      if (!isObj(c) || !Array.isArray(c.columns)) return null;
      return {
        context: {
          fileName: str(c.fileName, 200) ?? "dataset",
          rowCount: num(c.rowCount) ?? 0,
          domain: str(c.domain, 300) ?? "tidak diketahui",
          userPrompt: userText(c.userPrompt, 500),
          userContext: userText(c.userContext, 1_000),
          columns: columnStats(c.columns, 20),
          trends: trendList(c.trends, 5),
          correlations: corrList(c.correlations, 5),
          anomalies: anomalyList(c.anomalies, 5),
          kpis: kpiList(c.kpis),
          sample: sampleRecords(c.sample, 5),
        },
      };
    }
    case "chart": {
      const c = body.context;
      if (!isObj(c) || typeof c.chartType !== "string") return null;
      return {
        context: {
          chartType: str(c.chartType, 30)!,
          chartTitle: maskText(str(c.chartTitle, 200) ?? ""),
          chartDescription: maskText(str(c.chartDescription, 400) ?? ""),
          labels: labels(c.labels),
          datasets: datasets(c.datasets),
          domain: str(c.domain, 300),
        },
      };
    }
    case "followup": {
      const c = body.context;
      if (!isObj(c) || typeof c.lastQuestion !== "string" || typeof c.lastAnswer !== "string") return null;
      return {
        context: {
          lastQuestion: userText(c.lastQuestion, 500)!,
          lastAnswer: str(c.lastAnswer, 1_000)!,
          columns: strList(c.columns, 15, 100),
          domain: str(c.domain, 300),
        },
      };
    }
    case "report": {
      const c = body.context;
      if (!isObj(c) || !Array.isArray(c.columns)) return null;
      return {
        context: {
          fileName: str(c.fileName, 200) ?? "dataset",
          rowCount: num(c.rowCount) ?? 0,
          domain: str(c.domain, 300) ?? "tidak diketahui",
          summary: str(c.summary, 1_500),
          columns: columnStats(c.columns, 12),
          trends: trendList(c.trends, 4),
          correlations: corrList(c.correlations, 4),
          anomalies: anomalyList(c.anomalies, 4),
          kpis: kpiList(c.kpis),
          insights: arr(c.insights, 4)
            .filter(isObj)
            .map((i) => ({ type: str(i.type, 20) ?? "idea", title: str(i.title, 120) ?? "", body: str(i.body, 400) ?? "" })),
        },
      };
    }
    case "rename": {
      const c = body.context;
      if (!isObj(c)) return null;
      const headers = strList(c.headers, 100, 100);
      if (headers.length === 0) return null;
      return { context: { headers, domain: str(c.domain, 100), sample: sampleArrays(c.sample, headers, 3) } };
    }
    case "chart-insights": {
      const c = body.context;
      if (!isObj(c) || !Array.isArray(c.charts)) return null;
      return {
        context: {
          fileName: str(c.fileName, 200) ?? "dataset",
          domain: str(c.domain, 100),
          userContext: userText(c.userContext, 1_000),
          charts: arr(c.charts, 10)
            .filter(isObj)
            .map((ch) => ({
              id: str(ch.id, 100) ?? "",
              name: maskText(str(ch.name, 200) ?? ""),
              category: str(ch.category, 60),
              labels: labels(ch.labels),
              datasets: datasets(ch.datasets),
            }))
            .filter((ch) => ch.id.length > 0),
        },
      };
    }
  }
}

// ============================================================
// ANALYZE (legacy endpoint)
// ============================================================

/**
 * Samarkan sampel CSV mentah: kolom ber-nama PII dikosongkan, pola PII di
 * semua sel disamarkan. Parsing sederhana (cukup untuk masking — kalau
 * baris tidak sejajar header, seluruh baris tetap melewati maskText).
 */
export function maskCsvSample(sample: string): string {
  const lines = sample.split(/\r?\n/);
  if (lines.length < 2) return maskText(sample);
  const header = lines[0];
  const delim = [",", ";", "\t", "|"].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const headers = header.split(delim).map((h) => h.trim().replace(/^"|"$/g, ""));
  const out = [header];
  for (const line of lines.slice(1)) {
    const cells = line.split(delim);
    if (cells.length === headers.length) {
      out.push(maskArrayRow(cells, headers).map((c) => String(c ?? "")).join(delim));
    } else {
      out.push(maskText(line));
    }
  }
  return out.join("\n");
}
