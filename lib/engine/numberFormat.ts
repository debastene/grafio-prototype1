/**
 * Number format detector.
 *
 * Indonesia: 1.234,56 (period thousands, comma decimal)
 * English/US: 1,234.56 (comma thousands, period decimal)
 *
 * The same string "1,234" means 1234 (US) but is invalid in ID format.
 * The same string "1.234" means 1.234 (US) but means 1234 (ID).
 *
 * This module samples cells to detect the dominant format. The result is
 * passed to the parser to interpret numbers correctly.
 */

export type NumberFormat = "id" | "en" | "auto";

export type FormatDetection = {
  format: "id" | "en";
  confidence: number; // 0..1
  ambiguous: boolean; // true if both formats plausible
  idScore: number;
  enScore: number;
  samples: { value: string; idParse: number | null; enParse: number | null }[];
};

const ID_THOUSAND_DEC_RE = /^-?\d{1,3}(\.\d{3})+,\d+$/; // 1.234.567,89
const EN_THOUSAND_DEC_RE = /^-?\d{1,3}(,\d{3})+\.\d+$/; // 1,234,567.89
const ID_DEC_ONLY_RE = /^-?\d+,\d+$/; // 12,5
const EN_DEC_ONLY_RE = /^-?\d+\.\d+$/; // 12.5
const ID_THOUSAND_ONLY_RE = /^-?\d{1,3}(\.\d{3})+$/; // 1.234.567 (no decimal)
const EN_THOUSAND_ONLY_RE = /^-?\d{1,3}(,\d{3})+$/; // 1,234,567 (no decimal)

/**
 * Sample raw string values from the table — pick the strings most likely to be
 * numeric (contain digits + comma/period).
 */
function pickNumericCandidates(rawValues: (string | number | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of rawValues) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number") continue;
    const s = String(v).trim();
    if (s.length === 0) continue;
    // Must contain a digit and at least one separator
    if (!/\d/.test(s)) continue;
    if (!/[.,]/.test(s)) continue;
    // Skip obviously-non-numeric tokens (letters, dates with -, etc.)
    if (/[a-zA-Z]/.test(s)) continue;
    if (s.includes("-") || s.includes("/")) continue;
    out.push(s);
    if (out.length >= 200) break;
  }
  return out;
}

export function detectNumberFormat(
  rawValues: (string | number | null | undefined)[],
): FormatDetection {
  const candidates = pickNumericCandidates(rawValues);
  let idScore = 0;
  let enScore = 0;
  const samples: FormatDetection["samples"] = [];

  for (const s of candidates) {
    let idHit = 0;
    let enHit = 0;
    if (ID_THOUSAND_DEC_RE.test(s)) idHit += 5;
    if (EN_THOUSAND_DEC_RE.test(s)) enHit += 5;
    if (ID_DEC_ONLY_RE.test(s)) idHit += 1;
    if (EN_DEC_ONLY_RE.test(s)) enHit += 1;
    if (ID_THOUSAND_ONLY_RE.test(s)) idHit += 2;
    if (EN_THOUSAND_ONLY_RE.test(s)) enHit += 2;

    // Rule: if exactly one comma and digits after it look like dec (1-3 digits) AND no period before the comma → likely ID decimal
    // Same for period
    idScore += idHit;
    enScore += enHit;

    if (samples.length < 6) {
      samples.push({
        value: s,
        idParse: parseWithFormat(s, "id"),
        enParse: parseWithFormat(s, "en"),
      });
    }
  }

  let format: "id" | "en";
  let confidence: number;
  let ambiguous = false;

  if (idScore === 0 && enScore === 0) {
    // No clear sample — default to ID for Indonesian users
    format = "id";
    confidence = 0.3;
    ambiguous = true;
  } else if (idScore === enScore) {
    format = "id";
    confidence = 0.4;
    ambiguous = true;
  } else {
    const total = idScore + enScore;
    if (idScore > enScore) {
      format = "id";
      confidence = idScore / total;
    } else {
      format = "en";
      confidence = enScore / total;
    }
    // Ambiguous if confidence is low or both have score
    if (confidence < 0.7 && idScore > 0 && enScore > 0) ambiguous = true;
  }

  return { format, confidence, ambiguous, idScore, enScore, samples };
}

/**
 * Parse a string number using the specified format. Returns null if invalid.
 */
export function parseWithFormat(s: string, format: "id" | "en"): number | null {
  if (s === null || s === undefined) return null;
  const trimmed = String(s).trim();
  if (trimmed === "") return null;

  let cleaned = trimmed;

  // Strip currency symbols and spaces
  cleaned = cleaned.replace(/[$€£¥¢₹฿₽₩\s]/g, "");

  // Strip percent (caller should know it's a percent)
  const isPercent = cleaned.endsWith("%");
  if (isPercent) cleaned = cleaned.slice(0, -1);

  // Strip leading currency-y prefix like "Rp"
  cleaned = cleaned.replace(/^Rp/i, "").trim();

  if (format === "id") {
    // ID: period = thousand sep, comma = decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // EN: comma = thousand sep, period = decimal
    cleaned = cleaned.replace(/,/g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return isPercent ? n / 100 : n;
}

/**
 * Walk every cell in the table and convert string-numbers to actual numbers
 * using the user-confirmed format. Non-numeric strings stay as strings.
 *
 * Returns a new rows array (does not mutate the input).
 */
import type { ParsedRow } from "./parse";

export function applyNumberFormat(
  rows: ParsedRow[],
  headers: string[],
  format: "id" | "en",
): ParsedRow[] {
  return rows.map((r) => {
    const out: ParsedRow = {};
    for (const h of headers) {
      const v = r[h];
      if (typeof v === "string") {
        // Only attempt parse if the string contains a digit + at least one separator
        // OR is a plain integer/decimal
        const trimmed = v.trim();
        if (
          trimmed.length > 0 &&
          /\d/.test(trimmed) &&
          !/[a-zA-Z]/.test(trimmed) &&
          !trimmed.includes("/")
        ) {
          // Skip ISO-ish dates
          if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            out[h] = v;
            continue;
          }
          const parsed = parseWithFormat(trimmed, format);
          if (parsed !== null && Number.isFinite(parsed)) {
            out[h] = parsed;
            continue;
          }
        }
      }
      out[h] = v;
    }
    return out;
  });
}

