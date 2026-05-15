/**
 * Tabular data parser with type inference.
 * Supports CSV, TSV, JSON, JSONL. Detects delimiter, headers, and column types
 * (number, integer, percent, currency, date, boolean, categorical, text).
 */

export type ColType =
  | "number"
  | "integer"
  | "percent"
  | "currency"
  | "date"
  | "boolean"
  | "categorical"
  | "text";

export type ParsedRow = Record<string, string | number | boolean | null>;

export type ParsedTable = {
  headers: string[];
  rows: ParsedRow[];
  delimiter: string;
  rawRowCount: number;
  format: "csv" | "tsv" | "json" | "jsonl" | "unknown";
};

const DELIMS = [",", ";", "\t", "|"];

function detectDelimiter(sample: string): string {
  const firstLines = sample.split(/\r?\n/).slice(0, 5).filter(Boolean);
  const scores = DELIMS.map((d) => {
    const counts = firstLines.map((l) => l.split(d).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    // Want high count, low variance (consistent across rows)
    return { d, score: avg > 1 ? avg / (1 + variance) : 0 };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0].d;
}

/**
 * Properly handles quoted CSV fields — including commas, escaped quotes (""),
 * and newlines inside cells.
 */
function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) {
        result.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

function parseCSV(text: string, delim?: string): ParsedTable {
  const d = delim ?? detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: d, rawRowCount: 0, format: "csv" };
  }
  const headers = parseCSVLine(lines[0], d).map((h, i) => h || `col_${i + 1}`);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], d);
    const row: ParsedRow = {};
    for (let j = 0; j < headers.length; j++) {
      const v = cells[j] ?? "";
      row[headers[j]] = v === "" ? null : v;
    }
    rows.push(row);
  }
  return {
    headers,
    rows,
    delimiter: d,
    rawRowCount: rows.length,
    format: d === "\t" ? "tsv" : "csv",
  };
}

function parseJSONLike(text: string): ParsedTable {
  const trimmed = text.trim();
  let arr: any[] = [];
  let format: "json" | "jsonl" = "json";

  if (trimmed.startsWith("[")) {
    arr = JSON.parse(trimmed);
  } else {
    // Try JSONL
    arr = trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    format = "jsonl";
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    return { headers: [], rows: [], delimiter: "", rawRowCount: 0, format };
  }

  const headerSet = new Set<string>();
  for (const obj of arr) {
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) headerSet.add(k);
    }
  }
  const headers = Array.from(headerSet);
  const rows: ParsedRow[] = arr.map((obj) => {
    const r: ParsedRow = {};
    for (const h of headers) {
      const v = obj[h];
      if (v === undefined || v === null) r[h] = null;
      else if (typeof v === "object") r[h] = JSON.stringify(v);
      else r[h] = v as string | number | boolean;
    }
    return r;
  });

  return { headers, rows, delimiter: "", rawRowCount: rows.length, format };
}

export function parseText(text: string, ext: string): ParsedTable {
  const e = ext.toLowerCase();
  if (e === "json") return parseJSONLike(text);
  if (e === "jsonl" || e === "ndjson") return parseJSONLike(text);
  if (e === "tsv") return parseCSV(text, "\t");
  // Default: CSV-style auto-detect
  return parseCSV(text);
}

// ===== TYPE INFERENCE =====

const PERCENT_RE = /^-?\d+(\.\d+)?\s*%$/;
const CURRENCY_RE = /^[$€£¥¢₹฿₽₩]?\s*-?\d{1,3}(([,.]\d{3})*)?(\.\d+)?$|^-?\d{1,3}(([,.]\d{3})*)?(\.\d+)?\s*[$€£¥¢₹฿₩]?$/;
const NUMBER_RE = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
const INT_RE = /^-?\d+$/;
const BOOL_RE = /^(true|false|yes|no|y|n|0|1)$/i;
const DATE_RES: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?$/, // ISO
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i,
];

export function coerceValue(raw: string | number | boolean | null): {
  value: number | string | boolean | null;
  type: ColType | null;
} {
  if (raw === null || raw === undefined) return { value: null, type: null };
  if (typeof raw === "number") {
    return {
      value: raw,
      type: Number.isInteger(raw) ? "integer" : "number",
    };
  }
  if (typeof raw === "boolean") return { value: raw, type: "boolean" };

  const s = String(raw).trim();
  if (s === "") return { value: null, type: null };
  if (s.toLowerCase() === "null" || s.toLowerCase() === "na" || s === "-") {
    return { value: null, type: null };
  }

  if (PERCENT_RE.test(s)) {
    const n = parseFloat(s.replace("%", "")) / 100;
    return { value: n, type: "percent" };
  }
  // Currency: detect symbol + numeric body
  const stripped = s.replace(/[$€£¥¢₹฿₽₩\s,]/g, "");
  if (
    /[$€£¥¢₹฿₽₩]/.test(s) &&
    NUMBER_RE.test(stripped)
  ) {
    return { value: parseFloat(stripped), type: "currency" };
  }
  // Plain number with thousand separators
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    return { value: parseFloat(s.replace(/,/g, "")), type: "number" };
  }
  if (INT_RE.test(s)) return { value: parseInt(s, 10), type: "integer" };
  if (NUMBER_RE.test(s)) return { value: parseFloat(s), type: "number" };
  if (BOOL_RE.test(s)) {
    const lo = s.toLowerCase();
    return {
      value: lo === "true" || lo === "yes" || lo === "y" || lo === "1",
      type: "boolean",
    };
  }
  if (DATE_RES.some((r) => r.test(s))) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return { value: t, type: "date" };
  }
  return { value: s, type: "text" };
}

/**
 * Infer the dominant type of a column from its values.
 * Treats categorical = text with low cardinality.
 */
export function inferColType(values: (string | number | boolean | null)[]): ColType {
  const types: Record<string, number> = {};
  let nonNull = 0;
  for (const v of values) {
    const { type } = coerceValue(v);
    if (type) {
      types[type] = (types[type] ?? 0) + 1;
      nonNull++;
    }
  }
  if (nonNull === 0) return "text";

  // Pick dominant type (>= 70% of non-null)
  const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
  const [dominant, count] = sorted[0];
  if (count / nonNull < 0.7) {
    // Mixed — fall back to text/categorical
    const unique = new Set(values.filter((v) => v !== null).map(String));
    if (unique.size <= Math.max(20, nonNull * 0.1)) return "categorical";
    return "text";
  }

  if (dominant === "text") {
    const unique = new Set(values.filter((v) => v !== null).map(String));
    // If cardinality is low relative to row count, it's categorical
    if (unique.size <= Math.min(50, Math.max(20, nonNull * 0.1))) {
      return "categorical";
    }
    return "text";
  }
  return dominant as ColType;
}

export function isNumericType(t: ColType): boolean {
  return t === "number" || t === "integer" || t === "percent" || t === "currency";
}
