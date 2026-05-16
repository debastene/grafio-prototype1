/**
 * Natural-language insights in Bahasa Indonesia, intent-aware.
 */

import { Analysis, TrendResult } from "./analyze";
import { ColProfile } from "./profile";
import { formatByType, compactNumber } from "./stats";
import { Domain } from "./domain";

export type Insight = {
  type: "trend" | "anomaly" | "target" | "idea";
  title: string;
  body: string;
};

export type Kpi = {
  label: string;
  value: string;
  change: number;
};

function fmt(n: number, type: string, name?: string): string {
  return formatByType(n, type, name);
}

function trendInsight(t: TrendResult, profile: ColProfile, hasFocus: boolean): Insight {
  const focusPrefix = hasFocus ? "🎯 " : "";
  if (t.direction === "naik") {
    const forecastNote = t.forecast.length > 0 && t.r2 > 0.3
      ? ` Forecast 3 periode ke depan: ${fmt(t.forecast[0], profile.type, profile.name)} → ${fmt(t.forecast[2], profile.type, profile.name)}.`
      : "";
    return {
      type: "trend",
      title: `${focusPrefix}${t.column} tumbuh ${Math.abs(t.pctChange).toFixed(1)}%`,
      body: `Dari ${fmt(t.startValue, profile.type, profile.name)} → ${fmt(t.endValue, profile.type, profile.name)}. R²=${t.r2.toFixed(2)} (${t.r2 > 0.6 ? "sangat konsisten" : t.r2 > 0.3 ? "cukup konsisten" : "berfluktuasi"}).${forecastNote}`,
    };
  }
  if (t.direction === "turun") {
    const forecastNote = t.forecast.length > 0 && t.r2 > 0.3
      ? ` Bila tren berlanjut, periode 3 ke depan: ${fmt(t.forecast[2], profile.type, profile.name)}.`
      : "";
    return {
      type: "trend",
      title: `${focusPrefix}${t.column} turun ${Math.abs(t.pctChange).toFixed(1)}%`,
      body: `Dari ${fmt(t.startValue, profile.type, profile.name)} → ${fmt(t.endValue, profile.type, profile.name)}. Penurunan ${t.r2 > 0.5 ? "konsisten linear" : "tidak konsisten"} (R²=${t.r2.toFixed(2)}).${forecastNote}`,
    };
  }
  return {
    type: "trend",
    title: `${focusPrefix}${t.column} stabil`,
    body: `Tidak ada tren signifikan. Variasi ${Math.abs(t.pctChange).toFixed(1)}% dari awal ke akhir, R²=${t.r2.toFixed(2)}.`,
  };
}

export function generateInsights(analysis: Analysis, profiles: ColProfile[], domain?: Domain): Insight[] {
  const out: Insight[] = [];
  const intent = analysis.intentApplied;
  const focusSet = new Set(intent?.focusColumns ?? []);

  // Helper: should we surface this column first?
  const hasFocus = (col: string) => focusSet.has(col);

  // ===== Filtered-rows insight (if user mentioned values like "Indonesia")
  if (intent && analysis.filteredRowIndices && analysis.filteredRowIndices.length > 0) {
    const cols = intent.focusValueColumns;
    out.push({
      type: "target",
      title: `🎯 ${analysis.filteredRowIndices.length} baris cocok dengan filter`,
      body: `Filter: ${intent.focusValues.join(", ")} di kolom ${cols.join(", ")}. Insight di bawah memprioritaskan baris-baris ini.`,
    });
  }

  // ===== Sort trends — focused first, then by abs % change
  const sortedTrends = [...analysis.trends].sort((a, b) => {
    const fa = hasFocus(a.column) ? 1 : 0;
    const fb = hasFocus(b.column) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return Math.abs(b.pctChange) - Math.abs(a.pctChange);
  });

  // If user asked for trend specifically, give them up to 3
  const trendQuota = intent?.tags.has("trend") || intent?.tags.has("forecast") ? 3 : 2;
  for (const t of sortedTrends.slice(0, trendQuota)) {
    const p = profiles.find((x) => x.name === t.column);
    if (p) out.push(trendInsight(t, p, hasFocus(t.column)));
  }

  // ===== Correlation insights
  if (analysis.correlations.length > 0) {
    const c = analysis.correlations[0];
    const focused = hasFocus(c.a) || hasFocus(c.b);
    out.push({
      type: "target",
      title: `${focused ? "🎯 " : ""}${c.a} & ${c.b} berkorelasi ${c.strength}`,
      body: `Korelasi ${c.direction} dengan r=${c.r.toFixed(3)}. ${c.direction === "positif" ? "Saat satu naik, yang lain cenderung naik." : "Saat satu naik, yang lain cenderung turun."} ${Math.abs(c.r) > 0.7 ? "Hubungan kuat — kandidat untuk prediksi/modeling." : ""}`,
    });

    // If user asked for correlation, surface 2nd as well
    if (intent?.tags.has("correlation") && analysis.correlations.length > 1) {
      const c2 = analysis.correlations[1];
      out.push({
        type: "target",
        title: `${c2.a} & ${c2.b} (${c2.strength})`,
        body: `r=${c2.r.toFixed(3)} (${c2.direction}). Pasangan korelasi terkuat ke-2.`,
      });
    }
  }

  // ===== Anomalies
  if (analysis.anomalies.length > 0) {
    const sortedAnoms = [...analysis.anomalies].sort((a, b) => {
      const fa = hasFocus(a.column) ? 1 : 0;
      const fb = hasFocus(b.column) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return b.count - a.count;
    });
    const a = sortedAnoms[0];
    const p = profiles.find((x) => x.name === a.column);
    if (p && a.topExample) {
      out.push({
        type: "anomaly",
        title: `${hasFocus(a.column) ? "🎯 " : ""}${a.count} anomali di ${a.column}`,
        body: `Z-score tertinggi ${a.topExample.zscore.toFixed(2)} pada nilai ${fmt(a.topExample.value, p.type, p.name)} (baris #${a.topExample.rowIndex + 1}). ${Math.abs(a.topExample.zscore) > 3 ? "Outlier ekstrem — investigasi sumber data." : "Outlier moderat, layak diverifikasi."}`,
      });
    }
  }

  // ===== Segment gap
  if (analysis.segments.length > 0 && analysis.segments[0].spread > 0.3) {
    const s = analysis.segments[0];
    const profile = profiles.find((p) => p.name === s.metricCol);
    if (profile) {
      out.push({
        type: "idea",
        title: `${s.topGroup.name} unggul di ${s.metricCol}`,
        body: `${s.topGroup.name} (${fmt(s.topGroup.value, profile.type, profile.name)}) ${(s.spread * 100).toFixed(0)}% lebih tinggi dari ${s.bottomGroup.name} (${fmt(s.bottomGroup.value, profile.type, profile.name)}). Pertimbangkan replikasi pola dari segmen unggul.`,
      });
    }
  }

  // ===== Skewness / data quality (fillers)
  if (out.length < 5) {
    const skewed = profiles.find((p) => p.summary && Math.abs(p.summary.skewness) > 1.5 && !p.isLikelyId);
    if (skewed?.summary) {
      const dir = skewed.summary.skewness > 0 ? "kanan" : "kiri";
      out.push({
        type: "idea",
        title: `Distribusi ${skewed.name} miring ${dir}`,
        body: `Skewness ${skewed.summary.skewness.toFixed(2)}. Median (${fmt(skewed.summary.median, skewed.type, skewed.name)}) lebih representatif dari mean (${fmt(skewed.summary.mean, skewed.type, skewed.name)}). Pertimbangkan log-transform untuk modeling.`,
      });
    }
  }

  if (out.length < 5) {
    const highMissing = profiles.find((p) => p.missingPct > 0.3 && !p.isLikelyId);
    if (highMissing) {
      out.push({
        type: "idea",
        title: `${highMissing.name} banyak kosong`,
        body: `${(highMissing.missingPct * 100).toFixed(0)}% baris tidak terisi. Imputasi (mean/median/mode) atau drop kolom sebelum modeling.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      type: "idea",
      title: "Data berhasil diparse",
      body: `${analysis.rowCount} baris, ${analysis.numericCols.length} kolom numerik. Pertimbangkan upload dataset dengan kolom waktu/target untuk insight lebih dalam.`,
    });
  }

  return out.slice(0, 6);
}

export function generateKpis(analysis: Analysis, profiles: ColProfile[]): Kpi[] {
  const out: Kpi[] = [];
  for (const c of analysis.kpiCandidates.slice(0, 4)) {
    const p = profiles.find((x) => x.name === c.name);
    if (!p) continue;
    const useSum = p.type === "currency" || (p.type === "integer" && Math.abs(c.total) > 1000);
    const value = useSum ? c.total : c.mean;
    const valStr = formatByType(value, p.type, p.name);
    const change = c.trend ? Math.round(c.trend.pctChange * 10) / 10 : 0;
    out.push({
      label: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
      value: useSum ? `Σ ${valStr}` : valStr,
      change,
    });
  }
  return out;
}

/**
 * Engine's own narrative conclusion in plain Bahasa Indonesia.
 * This is the FALLBACK when AI is offline — gives a meaningful takeaway
 * instead of a generic stat dump.
 */
export function generateConclusion(
  analysis: Analysis,
  profiles: ColProfile[],
  domain?: Domain,
): string {
  const parts: string[] = [];

  const strongTrends = analysis.trends.filter(
    (t) => t.direction !== "datar" && Math.abs(t.pctChange) > 8 && t.r2 > 0.3,
  );
  const topCorr = analysis.correlations[0];
  const totalAnomalies = analysis.anomalies.reduce((sum, a) => sum + a.count, 0);

  // Open with domain framing
  if (domain && domain.id !== "generic") {
    parts.push(`Secara keseluruhan data ${domain.name.toLowerCase()} ini`);
  } else {
    parts.push("Secara keseluruhan data ini");
  }

  // Body: lead with the strongest signal
  if (strongTrends.length > 0) {
    const t = strongTrends[0];
    const mood = t.direction === "naik"
      ? Math.abs(t.pctChange) > 20 ? "menunjukkan momentum yang sangat panas" : "menunjukkan tren yang menanjak"
      : Math.abs(t.pctChange) > 20 ? "sedang mengalami penurunan tajam" : "cenderung melemah";
    const sentiment = t.r2 > 0.7 ? "secara konsisten" : t.r2 > 0.4 ? "meskipun fluktuatif" : "namun tidak stabil";
    parts.push(
      `${mood} di ${t.column} (${t.direction === "naik" ? "+" : ""}${t.pctChange.toFixed(1)}%) — pergerakan ini ${sentiment}.`,
    );
  } else if (topCorr && Math.abs(topCorr.r) > 0.6) {
    const ana = topCorr.r > 0
      ? "bergerak hampir berbarengan"
      : "bergerak berlawanan arah";
    parts.push(
      `memperlihatkan hubungan kuat antara ${topCorr.a} dan ${topCorr.b} — keduanya ${ana} (kekuatan ${topCorr.strength}).`,
    );
  } else if (analysis.segments.length > 0 && analysis.segments[0].spread > 0.4) {
    const s = analysis.segments[0];
    parts.push(
      `memperlihatkan ketimpangan jelas di ${s.metricCol}: ${s.topGroup.name} jauh di atas ${s.bottomGroup.name} (selisih ${(s.spread * 100).toFixed(0)}%).`,
    );
  } else {
    parts.push(`relatif stabil tanpa tren tajam — namun masih ada pola yang layak digali lebih dalam.`);
  }

  // Anomaly note (if significant)
  if (totalAnomalies > 0 && totalAnomalies > analysis.rowCount * 0.02) {
    parts.push(
      `Perlu diingat: ada ${totalAnomalies} titik data yang menjauh dari kerumunan — ini bisa jadi peluang investigasi atau data error yang perlu diverifikasi.`,
    );
  }

  // Forward-looking suggestion
  const forecastTrend = strongTrends.find((t) => t.forecast.length > 0 && t.r2 > 0.5);
  if (forecastTrend) {
    parts.push(
      `Bila pola ini bertahan, ${forecastTrend.column} berpotensi mencapai sekitar ${forecastTrend.forecast[2].toFixed(0)} di 3 periode ke depan — ini momentum yang patut diperhatikan.`,
    );
  } else if (analysis.kpiCandidates.length > 0) {
    parts.push(
      `Untuk pengambilan keputusan, fokuskan perhatian pada ${analysis.kpiCandidates.slice(0, 2).map((c) => c.name).join(" dan ")} — di sinilah sinyal utama dataset ini berada.`,
    );
  }

  return parts.join(" ");
}

export function generateSummary(
  analysis: Analysis,
  profiles: ColProfile[],
  fileName: string,
  domain?: Domain,
): string {
  const parts: string[] = [];
  const intent = analysis.intentApplied;

  if (intent && intent.raw) {
    parts.push(
      `Berdasarkan arahan "${intent.raw.length > 60 ? intent.raw.slice(0, 60) + "…" : intent.raw}":`,
    );
  }

  if (domain && domain.id !== "generic") {
    parts.push(`Dataset terdeteksi sebagai ${domain.name.toLowerCase()} — ${domain.description.toLowerCase()}.`);
  }

  parts.push(
    `${fileName} berisi ${analysis.rowCount} baris × ${profiles.length} kolom (${analysis.numericCols.length} numerik, ${analysis.categoricalCols.length} kategorikal${analysis.dateCols.length ? `, ${analysis.dateCols.length} tanggal` : ""}).`,
  );

  if (intent && intent.focusValues.length > 0) {
    parts.push(`Filter aktif: ${intent.focusValues.join(", ")} di kolom ${intent.focusValueColumns.join(", ")}.`);
  }

  const strongTrend = analysis.trends.find((t) => t.direction !== "datar" && Math.abs(t.pctChange) > 5);
  if (strongTrend) {
    parts.push(
      `Sinyal utama: ${strongTrend.column} ${strongTrend.direction} ${Math.abs(strongTrend.pctChange).toFixed(1)}%.`,
    );
  } else if (analysis.correlations.length > 0) {
    const c = analysis.correlations[0];
    parts.push(`Hubungan paling menonjol: ${c.a} ↔ ${c.b} (r=${c.r.toFixed(2)}, ${c.strength}).`);
  } else if (analysis.anomalies.length > 0) {
    const a = analysis.anomalies[0];
    parts.push(`Terdeteksi ${a.count} anomali di kolom ${a.column}.`);
  }

  const totalAnomalies = analysis.anomalies.reduce((a, b) => a + b.count, 0);
  if (totalAnomalies > 0 && !parts[parts.length - 1].includes("anomali")) {
    parts.push(`Total ${totalAnomalies} outlier statistik (z≥2.5).`);
  }

  return parts.join(" ");
}
