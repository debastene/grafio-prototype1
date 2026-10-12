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
 *
 * BUG sebelumnya: parser pakai `text.split(/\r?\n/)` DULU lalu parse quote
 * per-line. Header CSV yang multi-line quoted seperti:
 *
 *   Country,"Density
 *   (P/Km2)",Abbreviation,...
 *
 * jadi terpotong — quoted newline dianggap row baru. Akibatnya semua kolom
 * setelah "Density" hilang. Versi ini state-machine penuh karakter-by-
 * karakter yang aware quote lintas baris.
 */
function parseCSVStream(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuote = false;
        i++;
        continue;
      }
      // Newline INSIDE quote → tetap bagian dari cell value, BUKAN row baru
      cur += c;
      i++;
    } else {
      if (c === '"') {
        inQuote = true;
        i++;
        continue;
      }
      if (c === delim) {
        row.push(cur.trim());
        cur = "";
        i++;
        continue;
      }
      // Row terminator (\n atau \r\n) di luar quote → push row
      if (c === "\n" || c === "\r") {
        row.push(cur.trim());
        // Skip non-empty row only
        if (row.some((v) => v.length > 0)) {
          rows.push(row);
        }
        row = [];
        cur = "";
        // Consume \r\n as one terminator
        if (c === "\r" && text[i + 1] === "\n") i += 2;
        else i++;
        continue;
      }
      cur += c;
      i++;
    }
  }
  // Last cell / last row
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  return rows;
}

function parseCSV(text: string, delim?: string): ParsedTable {
  const d = delim ?? detectDelimiter(text);
  const tokens = parseCSVStream(text, d);
  if (tokens.length === 0) {
    return { headers: [], rows: [], delimiter: d, rawRowCount: 0, format: "csv" };
  }
  // Header row: pertahankan newline-as-space dalam nama kolom yang multi-line
  const headers = tokens[0].map((h, i) => {
    const cleaned = h.replace(/\s+/g, " ").trim();
    return cleaned || `col_${i + 1}`;
  });
  const rows: ParsedRow[] = [];
  for (let r = 1; r < tokens.length; r++) {
    const cells = tokens[r];
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
const NUMBER_RE = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
const INT_RE = /^-?\d+$/;
const BOOL_RE = /^(true|false|yes|no|y|n|0|1)$/i;

// ===== TANGGAL =====
//
// Date.parse() milik JS menganggap "05/01/2024" sebagai format AS (1 Mei),
// menerima tanggal mustahil ("2024-02-30" → 1 Maret), dan mencampur zona waktu
// lokal vs UTC. Untuk data Indonesia itu fatal, jadi tanggal di-parse manual:
//   - urutan hari/bulan dideteksi PER KOLOM (detectDateOrder)
//   - komponen divalidasi (bulan 1-12, hari ≤ jumlah hari bulan itu)
//   - semua dikonversi ke UTC supaya konsisten antar baris.

export type DateOrder = "dmy" | "mdy";
export type CoerceOptions = { dateOrder?: DateOrder };

const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMERIC_DATE_RE =
  /^(\d{1,2})([\/\-.])(\d{1,2})\2(\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2, pebruari: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

/** Nomor bulan (1-12) dari nama bulan Indonesia/Inggris (penuh/singkat), atau null. */
export function monthIndex(s: string): number | null {
  const k = s.trim().toLowerCase().replace(/\.$/, "");
  return MONTHS[k] ?? null;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function utcIfValid(y: number, m: number, d: number, hh = 0, mm = 0, ss = 0): number | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return Date.UTC(y, m - 1, d, hh, mm, ss);
}

function fullYear(y: string): number {
  const n = parseInt(y, 10);
  if (y.length === 4) return n;
  return n < 70 ? 2000 + n : 1900 + n;
}

/**
 * Parse string tanggal → epoch ms (UTC), atau null kalau bukan tanggal valid.
 */
export function parseDateString(s: string, order: DateOrder = "dmy"): number | null {
  let m = s.match(ISO_DATE_RE);
  if (m) {
    if (m[7]) {
      // Ada zona waktu eksplisit — validasi komponen tanggal, lalu hormati offset.
      if (utcIfValid(+m[1], +m[2], +m[3]) === null) return null;
      const t = Date.parse(s.replace(" ", "T"));
      return Number.isNaN(t) ? null : t;
    }
    return utcIfValid(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
  }

  // "2024-01" / "2024/01" → periode bulanan, tanggal 1
  m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return utcIfValid(+m[1], +m[2], 1);

  m = s.match(NUMERIC_DATE_RE);
  if (m) {
    const a = +m[1];
    const b = +m[3];
    const day = order === "dmy" ? a : b;
    const month = order === "dmy" ? b : a;
    return utcIfValid(fullYear(m[4]), month, day, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0, m[7] ? +m[7] : 0);
  }

  // "15 Januari 2024" / "15 Jan 2024"
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+\.?)\s+(\d{4})$/);
  if (m) {
    const mi = monthIndex(m[2]);
    return mi ? utcIfValid(+m[3], mi, +m[1]) : null;
  }
  // "Januari 2024" / "Jan 2024" → tanggal 1
  m = s.match(/^([A-Za-z]+\.?)\s+(\d{4})$/);
  if (m) {
    const mi = monthIndex(m[1]);
    return mi ? utcIfValid(+m[2], mi, 1) : null;
  }
  // "Jan 15, 2024" / "January 15 2024"
  m = s.match(/^([A-Za-z]+\.?)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mi = monthIndex(m[1]);
    return mi ? utcIfValid(+m[3], mi, +m[2]) : null;
  }
  return null;
}

/**
 * Tentukan urutan hari/bulan untuk satu kolom. Bukti: komponen pertama > 12
 * → pasti DD/MM; komponen kedua > 12 → pasti MM/DD. Kalau ambigu (semua ≤ 12)
 * default DD/MM — konvensi Indonesia.
 */
export function detectDateOrder(values: (string | number | boolean | null)[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    if (typeof v !== "string") continue;
    const m = v.trim().match(NUMERIC_DATE_RE);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[3] > 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

export function coerceValue(
  raw: string | number | boolean | null,
  opts: CoerceOptions = {},
): {
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
  // Kode berangka (no HP "0812…", kode "007") dan digit > 15 (NIK 16 digit,
  // no rekening) adalah IDENTIFIER, bukan angka: nol di depan hilang dan
  // presisi double rusak kalau dijadikan number.
  if (/^0\d+$/.test(s) || /^\d{16,}$/.test(s)) return { value: s, type: "text" };
  if (INT_RE.test(s)) return { value: parseInt(s, 10), type: "integer" };
  if (NUMBER_RE.test(s)) return { value: parseFloat(s), type: "number" };
  if (BOOL_RE.test(s)) {
    const lo = s.toLowerCase();
    return {
      value: lo === "true" || lo === "yes" || lo === "y" || lo === "1",
      type: "boolean",
    };
  }
  const t = parseDateString(s, opts.dateOrder ?? "dmy");
  if (t !== null) return { value: t, type: "date" };
  return { value: s, type: "text" };
}

/**
 * Infer the dominant type of a column from its values.
 * Treats categorical = text with low cardinality.
 */
export function inferColType(
  values: (string | number | boolean | null)[],
  opts: CoerceOptions = {},
): ColType {
  const dateOrder = opts.dateOrder ?? detectDateOrder(values);
  const types: Record<string, number> = {};
  let nonNull = 0;
  for (const v of values) {
    const { type } = coerceValue(v, { dateOrder });
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
