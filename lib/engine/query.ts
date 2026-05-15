/**
 * Natural-language query engine over the parsed table.
 *
 * Resolves questions like:
 *   - "Berapa rata-rata GDP?"  → mean of column
 *   - "Total population?"      → sum
 *   - "Top 5 negara berdasarkan life expectancy" → group/rank
 *   - "Korelasi GDP dan literacy?" → on-demand pearson
 *   - "Anomali di X?"          → outliers
 *   - "Negara mana paling tinggi GDP?" → argmax
 *   - "Berapa baris dengan X = Y?" → filter count
 *   - "Ringkas data ini"       → summary
 *
 * Tries all matchers; the first that produces a confident answer wins.
 */

import { EngineResult } from "./index";
import { ColProfile } from "./profile";
import { ParsedRow } from "./parse";
import { summarize, pearson, formatByType, compactNumber } from "./stats";
import { parseIntent } from "./intent";

export type QueryAnswer = {
  text: string;
  data?: { kind: "table"; rows: { name: string; value: string }[] }
        | { kind: "list"; items: string[] }
        | { kind: "scalar"; label: string; value: string };
  matchedColumns?: string[];
  confidence: number; // 0..1
};

function fmt(n: number, p?: ColProfile): string {
  if (!p) return compactNumber(n);
  return formatByType(n, p.type, p.name);
}

function findColumn(name: string, profiles: ColProfile[]): ColProfile | null {
  const n = name.toLowerCase().trim();
  let best: ColProfile | null = null;
  let bestScore = 0;
  for (const p of profiles) {
    const pn = p.name.toLowerCase();
    let score = 0;
    if (pn === n) score = 10;
    else if (pn.split(/[_\s\-./]/).includes(n)) score = 8;
    else if (pn.includes(n) || n.includes(pn)) score = Math.min(pn.length, n.length) >= 3 ? 5 : 2;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 2 ? best : null;
}

function listColumnsAnswer(profiles: ColProfile[]): QueryAnswer {
  return {
    text: `Dataset memiliki ${profiles.length} kolom: ${profiles.map((p) => p.name).join(", ")}.`,
    data: {
      kind: "list",
      items: profiles.map((p) => `${p.name} (${p.type}${p.summary ? `, mean ${fmt(p.summary.mean, p)}` : ""})`),
    },
    confidence: 1,
  };
}

function summarizeAnswer(result: EngineResult): QueryAnswer {
  return {
    text: result.summary,
    data: {
      kind: "list",
      items: result.insights.map((i) => `${i.title} — ${i.body}`),
    },
    confidence: 1,
  };
}

/**
 * Try to detect an aggregation query (sum/mean/median/min/max/count).
 */
function tryAggregation(q: string, profiles: ColProfile[]): QueryAnswer | null {
  const lower = q.toLowerCase();
  let agg: "sum" | "mean" | "median" | "min" | "max" | "count" | null = null;
  if (/\b(jumlah|total|sum|jumlahkan)\b/.test(lower)) agg = "sum";
  else if (/\b(rata-?rata|average|mean|avg)\b/.test(lower)) agg = "mean";
  else if (/\bmedian|tengah\b/.test(lower)) agg = "median";
  else if (/\b(minimum|terendah|terkecil|min|paling rendah|paling kecil)\b/.test(lower)) agg = "min";
  else if (/\b(maximum|tertinggi|terbesar|max|paling tinggi|paling besar|maksimum)\b/.test(lower)) agg = "max";
  else if (/\b(banyak|hitung|count|berapa banyak)\b/.test(lower) && !/\bbaris dengan\b/.test(lower)) agg = "count";

  if (!agg) return null;

  // Find the column the user is asking about
  const tokens = q.replace(/[^a-zA-Z0-9\s_-]/g, " ").split(/\s+/).filter(Boolean);
  let bestCol: ColProfile | null = null;
  let bestScore = 0;
  for (const p of profiles) {
    const c = findColumn(p.name, profiles);
    // Score by token match
    const pn = p.name.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      const tl = t.toLowerCase();
      if (tl.length < 3) continue;
      if (pn === tl) score += 8;
      else if (pn.split(/[_\s\-./]/).includes(tl)) score += 5;
      else if (pn.includes(tl)) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCol = p;
    }
  }

  if (!bestCol) {
    // Special: if they asked count without a column → row count
    if (agg === "count") {
      return null;
    }
    return null;
  }

  if (agg === "count") {
    const nonNull = bestCol.total - bestCol.missing;
    return {
      text: `Kolom ${bestCol.name} memiliki ${nonNull} nilai non-null (${bestCol.missing} missing dari ${bestCol.total} total).`,
      data: { kind: "scalar", label: bestCol.name, value: String(nonNull) },
      matchedColumns: [bestCol.name],
      confidence: 0.9,
    };
  }

  if (!bestCol.summary) {
    return {
      text: `Kolom ${bestCol.name} bukan kolom numerik, jadi tidak bisa dihitung ${agg}.`,
      confidence: 0.7,
    };
  }

  const s = bestCol.summary;
  let value = 0;
  let label = "";
  switch (agg) {
    case "sum": value = s.sum; label = "Total"; break;
    case "mean": value = s.mean; label = "Rata-rata"; break;
    case "median": value = s.median; label = "Median"; break;
    case "min": value = s.min; label = "Minimum"; break;
    case "max": value = s.max; label = "Maximum"; break;
  }

  return {
    text: `${label} ${bestCol.name} = ${fmt(value, bestCol)} (dari ${s.count} nilai non-null, std=${fmt(s.std, bestCol)}).`,
    data: { kind: "scalar", label: `${label} ${bestCol.name}`, value: fmt(value, bestCol) },
    matchedColumns: [bestCol.name],
    confidence: 0.95,
  };
}

/**
 * Top-N ranking query.
 */
function tryRanking(q: string, profiles: ColProfile[], rows: ParsedRow[]): QueryAnswer | null {
  const lower = q.toLowerCase();
  const wantsTop = /\b(top|teratas|tertinggi|terbaik|paling tinggi|paling besar|paling banyak)\b/.test(lower);
  const wantsBottom = /\b(bottom|terbawah|terendah|terburuk|paling rendah|paling kecil|paling sedikit)\b/.test(lower);
  if (!wantsTop && !wantsBottom) return null;

  const m = q.match(/\b(\d+)\b/);
  const n = m ? parseInt(m[1], 10) : 5;

  // Find metric column (numeric)
  const numericProfiles = profiles.filter((p) => p.summary);
  let metric: ColProfile | null = null;
  let bestMetricScore = 0;
  for (const p of numericProfiles) {
    const pn = p.name.toLowerCase();
    let score = 0;
    const tokens = q.toLowerCase().split(/\s+/);
    for (const t of tokens) {
      if (t.length < 3) continue;
      if (pn === t) score += 8;
      else if (pn.split(/[_\s\-./]/).includes(t)) score += 5;
      else if (pn.includes(t)) score += 2;
    }
    if (p.isLikelyTarget) score += 1;
    if (score > bestMetricScore) {
      bestMetricScore = score;
      metric = p;
    }
  }
  if (!metric) return null;

  // Find label column (categorical or text with high cardinality)
  let label: ColProfile | null = null;
  let bestLabelScore = 0;
  for (const p of profiles) {
    if (p.type !== "categorical" && p.type !== "text") continue;
    if (p === metric) continue;
    let s = 0;
    const tokens = q.toLowerCase().split(/\s+/);
    for (const t of tokens) {
      if (t.length < 3) continue;
      const pn = p.name.toLowerCase();
      if (pn === t) s += 8;
      else if (pn.includes(t)) s += 3;
    }
    // Prefer columns with high uniqueness (likely labels)
    s += p.uniqueRatio * 5;
    if (s > bestLabelScore) {
      bestLabelScore = s;
      label = p;
    }
  }
  // If no label column, use row indices
  const labelName = label?.name;

  const items = rows.map((r, idx) => {
    const v = metric!.numericVector?.[idx];
    return {
      label: labelName ? String(r[labelName] ?? `#${idx + 1}`) : `#${idx + 1}`,
      value: typeof v === "number" && Number.isFinite(v) ? v : null,
    };
  }).filter((x): x is { label: string; value: number } => x.value !== null);

  items.sort((a, b) => wantsTop ? b.value - a.value : a.value - b.value);
  const top = items.slice(0, n);
  const dirText = wantsTop ? "tertinggi" : "terendah";

  return {
    text: `${n} ${labelName ?? "baris"} dengan ${metric.name} ${dirText}:`,
    data: {
      kind: "table",
      rows: top.map((t) => ({ name: t.label, value: fmt(t.value, metric!) })),
    },
    matchedColumns: [metric.name, ...(labelName ? [labelName] : [])],
    confidence: 0.9,
  };
}

/**
 * Correlation query.
 */
function tryCorrelation(q: string, profiles: ColProfile[]): QueryAnswer | null {
  const lower = q.toLowerCase();
  if (!/\b(korelasi|correlation|hubungan|relationship|berkaitan|related|vs|berhubungan)\b/.test(lower)) return null;

  const numProfiles = profiles.filter((p) => p.summary);
  if (numProfiles.length < 2) return null;

  // Find two columns mentioned in the prompt
  const matched: ColProfile[] = [];
  for (const p of numProfiles) {
    const pn = p.name.toLowerCase();
    const tokens = lower.split(/\s+/);
    for (const t of tokens) {
      if (t.length < 3) continue;
      if (pn === t || pn.split(/[_\s\-./]/).includes(t) || (pn.includes(t) && t.length >= 4)) {
        if (!matched.includes(p)) matched.push(p);
        break;
      }
    }
    if (matched.length >= 2) break;
  }

  if (matched.length < 2) return null;
  const [a, b] = matched;
  if (!a.numericVector || !b.numericVector) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < a.numericVector.length; i++) {
    const x = a.numericVector[i];
    const y = b.numericVector[i];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < 5) return { text: `Data tidak cukup untuk korelasi ${a.name} & ${b.name}.`, confidence: 0.5 };
  const r = pearson(xs, ys);
  const strength = Math.abs(r) >= 0.7 ? "sangat kuat" : Math.abs(r) >= 0.5 ? "kuat" : Math.abs(r) >= 0.3 ? "sedang" : "lemah";
  const dir = r > 0 ? "positif" : "negatif";
  return {
    text: `Korelasi Pearson ${a.name} ↔ ${b.name} = ${r.toFixed(3)} (${strength}, ${dir}). Berdasarkan ${xs.length} pasangan nilai.`,
    data: { kind: "scalar", label: `r(${a.name}, ${b.name})`, value: r.toFixed(3) },
    matchedColumns: [a.name, b.name],
    confidence: 0.95,
  };
}

/**
 * Trend query.
 */
function tryTrend(q: string, result: EngineResult): QueryAnswer | null {
  const lower = q.toLowerCase();
  if (!/\b(tren|trend|naik|turun|growth|pertumbuhan|forecast|prediksi)\b/.test(lower)) return null;

  // Find which trend the user asked about
  const tokens = lower.split(/\s+/);
  let best = result.analysis.trends[0];
  let bestScore = best ? 1 : 0;
  for (const t of result.analysis.trends) {
    const pn = t.column.toLowerCase();
    let s = 0;
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      if (pn === tok) s += 8;
      else if (pn.includes(tok)) s += 3;
    }
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  if (!best) return null;
  const profile = result.profile.find((p) => p.name === best.column);
  const fcText = best.forecast.length > 0
    ? ` Forecast 3 langkah: ${best.forecast.map((v) => fmt(v, profile)).join(", ")}.`
    : "";
  return {
    text: `Tren ${best.column}: ${best.direction} ${Math.abs(best.pctChange).toFixed(1)}% (${fmt(best.startValue, profile)} → ${fmt(best.endValue, profile)}). R²=${best.r2.toFixed(2)} ${best.r2 > 0.6 ? "(sangat konsisten)" : best.r2 > 0.3 ? "(cukup konsisten)" : "(berfluktuasi)"}.${fcText}`,
    matchedColumns: [best.column],
    confidence: 0.9,
  };
}

/**
 * Anomaly query.
 */
function tryAnomaly(q: string, result: EngineResult): QueryAnswer | null {
  const lower = q.toLowerCase();
  if (!/\b(anomali|anomaly|outlier|aneh|ekstrem|tidak biasa|unusual)\b/.test(lower)) return null;

  if (result.analysis.anomalies.length === 0) {
    return { text: "Tidak ada outlier signifikan (Z-score ≥ 2.5) terdeteksi.", confidence: 0.9 };
  }

  // Find specific column if user mentioned one
  const tokens = lower.split(/\s+/);
  let target = result.analysis.anomalies[0];
  for (const a of result.analysis.anomalies) {
    const pn = a.column.toLowerCase();
    if (tokens.some((t) => t.length >= 3 && pn.includes(t))) {
      target = a;
      break;
    }
  }
  const profile = result.profile.find((p) => p.name === target.column);

  return {
    text: `${target.column}: ${target.count} outlier (Z-score ≥ 2.5).${target.topExample ? ` Tertinggi: nilai ${fmt(target.topExample.value, profile)} dengan z=${target.topExample.zscore.toFixed(2)} di baris #${target.topExample.rowIndex + 1}.` : ""}`,
    matchedColumns: [target.column],
    confidence: 0.9,
  };
}

/**
 * Filter count: "berapa baris dengan X = Y"
 */
function tryFilter(q: string, profiles: ColProfile[], rows: ParsedRow[]): QueryAnswer | null {
  const m = q.match(/(?:dengan|where|saat)\s+(\w[\w\s]*?)\s*(?:=|adalah|equals|sama dengan)\s+([^?]+)/i);
  if (!m) return null;
  const colName = m[1].trim();
  const valWanted = m[2].trim().replace(/['"]/g, "").trim();

  const col = findColumn(colName, profiles);
  if (!col) return null;
  let count = 0;
  for (const r of rows) {
    const v = r[col.name];
    if (v === null || v === undefined) continue;
    if (String(v).toLowerCase() === valWanted.toLowerCase()) count++;
  }
  return {
    text: `${count} baris memenuhi ${col.name} = ${valWanted}.`,
    data: { kind: "scalar", label: `${col.name} = ${valWanted}`, value: String(count) },
    matchedColumns: [col.name],
    confidence: 0.9,
  };
}

/**
 * Specific row argmax: "X mana yang paling tinggi Y"
 */
function tryArgmax(q: string, profiles: ColProfile[], rows: ParsedRow[]): QueryAnswer | null {
  const lower = q.toLowerCase();
  const wantsMax = /\b(paling tinggi|paling besar|paling banyak|tertinggi|terbesar|max)\b/.test(lower);
  const wantsMin = /\b(paling rendah|paling kecil|paling sedikit|terendah|terkecil|min)\b/.test(lower);
  if (!wantsMax && !wantsMin) return null;

  const numProfiles = profiles.filter((p) => p.summary);
  let metric: ColProfile | null = null;
  let bestScore = 0;
  for (const p of numProfiles) {
    const pn = p.name.toLowerCase();
    const tokens = lower.split(/\s+/);
    let s = 0;
    for (const t of tokens) {
      if (t.length < 3) continue;
      if (pn === t) s += 8;
      else if (pn.includes(t)) s += 3;
    }
    if (s > bestScore) {
      bestScore = s;
      metric = p;
    }
  }
  if (!metric || !metric.numericVector) return null;

  let bestIdx = -1;
  let bestVal = wantsMax ? -Infinity : Infinity;
  for (let i = 0; i < metric.numericVector.length; i++) {
    const v = metric.numericVector[i];
    if (!Number.isFinite(v)) continue;
    if (wantsMax ? v > bestVal : v < bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return null;

  // Find a label column
  const labelCol = profiles.find((p) => p.type === "categorical" || p.type === "text");
  const labelVal = labelCol ? String(rows[bestIdx][labelCol.name] ?? `#${bestIdx + 1}`) : `Baris #${bestIdx + 1}`;

  return {
    text: `${labelVal} memiliki ${metric.name} ${wantsMax ? "tertinggi" : "terendah"}: ${fmt(bestVal, metric)}.`,
    data: { kind: "scalar", label: labelVal, value: fmt(bestVal, metric) },
    matchedColumns: [metric.name, ...(labelCol ? [labelCol.name] : [])],
    confidence: 0.85,
  };
}

/**
 * Main entry — run all matchers and pick the most confident.
 */
export function answerQuery(question: string, result: EngineResult): QueryAnswer {
  const q = question.trim();
  if (!q) {
    return {
      text: "Tanyakan apa saja tentang data Anda — total, rata-rata, top N, korelasi, tren, anomali, dll.",
      confidence: 1,
    };
  }

  const lower = q.toLowerCase();

  // Quick directives
  if (/\b(kolom apa|columns|column list|berapa kolom|how many columns)\b/.test(lower)) {
    return listColumnsAnswer(result.profile);
  }
  if (/\b(ringkas|summary|summarize|rangkum|overview|gambaran)\b/.test(lower) && q.length < 50) {
    return summarizeAnswer(result);
  }
  if (/\b(berapa baris|how many rows|jumlah baris|total baris)\b/.test(lower)) {
    return {
      text: `Dataset memiliki ${result.rowCount} baris (${result.columnCount} kolom).`,
      data: { kind: "scalar", label: "Total baris", value: result.rowCount.toLocaleString("id") },
      confidence: 1,
    };
  }

  // Try matchers in priority order
  const matchers: Array<() => QueryAnswer | null> = [
    () => tryFilter(q, result.profile, result.tableSnapshot.rows),
    () => tryArgmax(q, result.profile, result.tableSnapshot.rows),
    () => tryRanking(q, result.profile, result.tableSnapshot.rows),
    () => tryCorrelation(q, result.profile),
    () => tryTrend(q, result),
    () => tryAnomaly(q, result),
    () => tryAggregation(q, result.profile),
  ];

  let bestAnswer: QueryAnswer | null = null;
  for (const m of matchers) {
    const ans = m();
    if (ans && (!bestAnswer || ans.confidence > bestAnswer.confidence)) {
      bestAnswer = ans;
    }
  }
  if (bestAnswer) return bestAnswer;

  // Fallback — try to find any column the user mentioned and return its profile
  const intent = parseIntent(q, result.profile, result.tableSnapshot.rows);
  if (intent.focusColumns.length > 0) {
    const col = result.profile.find((p) => p.name === intent.focusColumns[0]);
    if (col) {
      const s = col.summary;
      if (s) {
        return {
          text: `Profil kolom ${col.name} (${col.type}): mean ${fmt(s.mean, col)}, median ${fmt(s.median, col)}, std ${fmt(s.std, col)}, range ${fmt(s.min, col)} – ${fmt(s.max, col)}, ${col.outlierCount ?? 0} outlier.`,
          matchedColumns: [col.name],
          confidence: 0.7,
        };
      }
      return {
        text: `Kolom ${col.name} (${col.type}): ${col.unique} unique values, ${(col.missingPct * 100).toFixed(0)}% missing. Top: ${col.topValues?.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(", ") ?? "—"}.`,
        matchedColumns: [col.name],
        confidence: 0.7,
      };
    }
  }

  // No match
  return {
    text: `Saya belum mengerti pertanyaan itu. Coba: "rata-rata GDP", "top 5 berdasarkan population", "korelasi GDP dan literacy", "anomali di X", "tren X", atau "ringkas data".`,
    confidence: 0.1,
  };
}

/**
 * Generate context-aware suggestion chips based on actual data.
 */
export function suggestQuestions(result: EngineResult): string[] {
  const out: string[] = [];
  const numericTargets = result.profile.filter((p) => p.summary && (p.isLikelyTarget || p.summary.cv > 0.1));
  const cat = result.analysis.primaryCategoryCol;
  const topCorr = result.analysis.correlations[0];
  const topTrend = result.analysis.trends[0];
  const topAnom = result.analysis.anomalies[0];

  if (numericTargets[0]) out.push(`Rata-rata ${numericTargets[0].name}?`);
  if (cat && numericTargets[0]) out.push(`Top 5 ${cat} berdasarkan ${numericTargets[0].name}`);
  if (topCorr) out.push(`Korelasi ${topCorr.a} dan ${topCorr.b}`);
  if (topTrend) out.push(`Tren ${topTrend.column}`);
  if (topAnom) out.push(`Anomali di ${topAnom.column}`);
  if (numericTargets[1]) out.push(`Total ${numericTargets[1].name}`);
  out.push("Ringkas data ini");

  return out.slice(0, 6);
}
