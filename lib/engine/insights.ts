/**
 * Natural-language insights in Bahasa Indonesia, intent-aware.
 *
 * Aturan kejujuran: insight tren/korelasi/segmen hanya ditulis kalau hasil
 * uji statistiknya signifikan (lihat ALPHA di analyze.ts). Angka p-value
 * disebut supaya pembaca yang paham statistik bisa memverifikasi.
 */

import { Analysis, TrendResult, aggregationFor, resolveTimeX } from "./analyze";
import { ColProfile } from "./profile";
import { aggregateSeries, compactNumber, formatByType, formatP, systematicSample } from "./stats";
import { Domain } from "./domain";
import { MultivariateResult, kmoLabel } from "./multivariate";
import { ForecastBundle, mapeLabel, methodLabel } from "./forecast";

export type Insight = {
  type: "trend" | "anomaly" | "target" | "idea";
  title: string;
  body: string;
};

export type Kpi = {
  label: string;
  value: string;
  /**
   * Perubahan % menurut garis tren yang SIGNIFIKAN. null = tidak ada sumbu
   * waktu / tren tidak signifikan — UI tidak boleh menampilkan panah naik/turun.
   */
  change: number | null;
  /** Deret per periode (maks 12 titik) untuk sparkline; kosong kalau tak ada sumbu waktu. */
  spark?: number[];
};

function fmt(n: number, type: string, name?: string): string {
  return formatByType(n, type, name);
}

function trendInsight(t: TrendResult, profile: ColProfile, hasFocus: boolean): Insight {
  const focusPrefix = hasFocus ? "🎯 " : "";
  const aggNote = t.aggregation === "sum" ? "total per periode" : "rata-rata per periode";
  const stat = `R²=${t.r2.toFixed(2)}, ${formatP(t.pValue ?? 1)}, ${t.periods ?? "?"} periode (${aggNote})`;
  const piNote =
    t.forecast.length > 0 && t.forecastLower?.length && Number.isFinite(t.forecastLower[2])
      ? ` Proyeksi 3 periode ke depan: ±${fmt(t.forecast[2], profile.type, profile.name)} (rentang 95%: ${fmt(t.forecastLower[2], profile.type, profile.name)} – ${fmt(t.forecastUpper![2], profile.type, profile.name)}).`
      : "";

  if (t.direction === "naik" || t.direction === "turun") {
    const verb = t.direction === "naik" ? "tumbuh" : "turun";
    return {
      type: "trend",
      title: `${focusPrefix}${t.column} ${verb} ${Math.abs(t.pctChange).toFixed(1)}%`,
      body: `Garis tren bergerak dari ${fmt(t.startValue, profile.type, profile.name)} → ${fmt(t.endValue, profile.type, profile.name)} (${stat}).${piNote}`,
    };
  }
  return {
    type: "trend",
    title: `${focusPrefix}${t.column} tanpa tren signifikan`,
    body: `Naik-turunnya ${t.column} belum bisa dibedakan dari fluktuasi acak (${stat}). Jangan ambil keputusan berdasarkan "tren" di kolom ini dulu.`,
  };
}

export function generateInsights(
  analysis: Analysis,
  profiles: ColProfile[],
  domain?: Domain,
  multivariate?: MultivariateResult | null,
  forecasts?: ForecastBundle | null,
): Insight[] {
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

  // ===== Tidak ada sumbu waktu → beri tahu, jangan mengarang tren
  const wantsTrend = intent?.tags.has("trend") || intent?.tags.has("forecast");
  if (!analysis.timeAxis && wantsTrend) {
    out.push({
      type: "idea",
      title: "Data ini tidak punya kolom waktu",
      body: "Tren & forecast butuh kolom tanggal/tahun/bulan. Urutan baris di file bukan urutan waktu, jadi Grafio tidak menghitung tren — fokus ke perbandingan antar kelompok dan korelasi.",
    });
  }

  // ===== Trends — signifikan dulu, lalu fokus user, lalu |%|
  const sortedTrends = [...analysis.trends].sort((a, b) => {
    const sa = a.direction !== "datar" ? 1 : 0;
    const sb = b.direction !== "datar" ? 1 : 0;
    if (sa !== sb) return sb - sa;
    const fa = hasFocus(a.column) ? 1 : 0;
    const fb = hasFocus(b.column) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return Math.abs(b.pctChange) - Math.abs(a.pctChange);
  });

  // If user asked for trend specifically, give them up to 3
  const trendQuota = wantsTrend ? 3 : 2;
  for (const t of sortedTrends.slice(0, trendQuota)) {
    const p = profiles.find((x) => x.name === t.column);
    if (p) out.push(trendInsight(t, p, hasFocus(t.column)));
  }

  // ===== Ramalan ARIMA (satu insight, kolom pertama yang berhasil dimodelkan)
  const fcInsight = forecastInsight(forecasts, profiles);
  if (fcInsight) out.push(fcInsight);

  // ===== Correlation insights (sudah lolos uji + koreksi BH di analyze)
  if (analysis.correlations.length > 0) {
    const c = analysis.correlations[0];
    const focused = hasFocus(c.a) || hasFocus(c.b);
    out.push({
      type: "target",
      title: `${focused ? "🎯 " : ""}${c.a} & ${c.b} berkorelasi ${c.strength}`,
      body: `Korelasi ${c.direction} r=${c.r.toFixed(3)} dari ${c.n ?? "?"} pasangan data (${formatP(c.qValue ?? c.pValue ?? 1)} setelah koreksi uji berganda). ${c.direction === "positif" ? "Saat satu naik, yang lain cenderung ikut naik." : "Saat satu naik, yang lain cenderung turun."} Ingat: korelasi bukan sebab-akibat.`,
    });

    // If user asked for correlation, surface 2nd as well
    if (intent?.tags.has("correlation") && analysis.correlations.length > 1) {
      const c2 = analysis.correlations[1];
      out.push({
        type: "target",
        title: `${c2.a} & ${c2.b} (${c2.strength})`,
        body: `r=${c2.r.toFixed(3)} (${c2.direction}, ${formatP(c2.qValue ?? c2.pValue ?? 1)}). Pasangan korelasi terkuat ke-2.`,
      });
    }
  }

  // ===== Anomalies (pagar Tukey 1.5×IQR + modified z-score)
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
      // Pagar bawah negatif tidak bermakna untuk data yang selalu ≥ 0 (populasi, harga).
      const lo = a.fences && p.summary && p.summary.min >= 0 ? Math.max(0, a.fences.lo) : a.fences?.lo;
      const fenceNote = a.fences && lo !== undefined
        ? ` (di luar rentang wajar ${fmt(lo, p.type, p.name)} – ${fmt(a.fences.hi, p.type, p.name)})`
        : "";
      out.push({
        type: "anomaly",
        title: `${hasFocus(a.column) ? "🎯 " : ""}${a.count} nilai tidak biasa di ${a.column}`,
        body: `Paling ekstrem: ${fmt(a.topExample.value, p.type, p.name)} di baris #${a.topExample.rowIndex + 1}${fenceNote}, z robust ${a.topExample.zscore.toFixed(1)}. ${Math.abs(a.topExample.zscore) > 3.5 ? "Sangat jauh dari kerumunan — cek apakah salah input atau kejadian khusus." : "Menyimpang moderat, layak diverifikasi."}`,
      });
    }
  }

  // ===== Segment gap — hanya kalau ANOVA signifikan
  const seg = analysis.segments.find((s) => s.significant !== false && s.spread > 0.3);
  if (seg) {
    const profile = profiles.find((p) => p.name === seg.metricCol);
    if (profile) {
      out.push({
        type: "idea",
        title: `${seg.topGroup.name} unggul di ${seg.metricCol}`,
        body: `Rata-rata ${seg.topGroup.name} (${fmt(seg.topGroup.value, profile.type, profile.name)}) ${(seg.spread * 100).toFixed(0)}% lebih tinggi dari ${seg.bottomGroup.name} (${fmt(seg.bottomGroup.value, profile.type, profile.name)}); beda antar ${seg.groupCol} signifikan (ANOVA ${formatP(seg.pValue ?? 1)}). Pertimbangkan replikasi pola dari kelompok unggul.`,
      });
    }
  }

  // ===== Multivariat: klaster (hanya kalau strukturnya minimal "lemah")
  out.push(...multivariateInsights(multivariate, profiles));

  // ===== Skewness / data quality (fillers)
  if (out.length < 5) {
    const skewed = profiles.find(
      (p) => p.summary && Math.abs(p.summary.skewness) > 1.5 && !p.isLikelyId && !p.timeKind && p.summary.count >= 8,
    );
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
        body: `${(highMissing.missingPct * 100).toFixed(0)}% baris tidak terisi. Imputasi (median/modus) menyempitkan sebaran & melemahkan korelasi — pertimbangkan drop kolom atau analisis tanpa kolom ini.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      type: "idea",
      title: "Belum ada pola yang signifikan",
      body: `${analysis.rowCount} baris, ${analysis.numericCols.length} kolom numerik. Tidak ada tren, korelasi, atau beda kelompok yang lolos uji statistik — bisa karena data terlalu sedikit atau memang tidak ada pola kuat.`,
    });
  }

  return out.slice(0, 6);
}

/**
 * Insight ramalan ARIMA. Selalu menyebut rentang 95% dan hasil uji holdout —
 * kalau ARIMA kalah dari metode naif, itu ditulis terang-terangan.
 */
export function forecastInsight(fc: ForecastBundle | null | undefined, profiles: ColProfile[]): Insight | null {
  const f = fc?.items[0];
  if (!f) return null;
  const p = profiles.find((x) => x.name === f.column);
  const v = (n: number) => (p ? fmt(n, p.type, p.name) : compactNumber(n));
  const h = f.future.mean.length;
  const last = h - 1;
  const ho = f.holdout;
  const evalText = !ho
    ? ""
    : ho.best === "arima"
      ? ` Diuji pada ${ho.h} periode terakhir: ${ho.model.split("(")[0]} paling akurat${ho.arima.mape !== null ? ` (MAPE ${ho.arima.mape.toFixed(1)}%, ${mapeLabel(ho.arima.mape)})` : ""}, mengalahkan metode naif${ho.seasonalNaive ? ", naif musiman" : ""} & regresi linear.`
      : ` Catatan: pada ${ho.h} periode uji, metode ${methodLabel(ho.best)} lebih akurat dari model ini — pakai ramalan ini sebagai gambaran kasar.`;
  return {
    type: "trend",
    title: `Ramalan ${f.column}: ${v(f.future.mean[last])} dalam ${h} ${f.granularity}`,
    body: `${f.model.label} memperkirakan ${f.column} (${f.aggregation === "sum" ? "total" : "rata-rata"} per ${f.granularity}) di ${f.future.labels[last]} sekitar ${v(f.future.mean[last])}, rentang 95%: ${v(f.future.lower[last])} – ${v(f.future.upper[last])}.${evalText}`,
  };
}

/**
 * Insight dari PCA & k-means. Ditulis hanya kalau hasil ujinya mendukung:
 * klaster dengan silhouette > 0,25; PCA bila Bartlett signifikan & KMO ≥ 0,6.
 */
export function multivariateInsights(mv: MultivariateResult | null | undefined, profiles: ColProfile[]): Insight[] {
  const out: Insight[] = [];
  if (!mv) return out;
  const fmtCol = (col: string, v: number) => {
    const p = profiles.find((x) => x.name === col);
    return p ? formatByType(v, p.type, p.name) : compactNumber(v);
  };

  const c = mv.clusters;
  const tiny = new Set(c?.tinyClusters ?? []);
  const realSegments = c ? c.profiles.filter((g) => !tiny.has(g.cluster)) : [];
  if (c && c.structure !== "tidak ada" && realSegments.length < 2) {
    // Silhouette tinggi tapi yang terpisah hanya segelintir baris ekstrem.
    const outl = c.profiles.filter((g) => tiny.has(g.cluster));
    out.push({
      type: "anomaly",
      title: "Tidak ada segmen yang bermakna",
      body: `k-means hanya memisahkan ${outl.map((g) => `${g.size} baris ekstrem (${Math.round(g.share * 100)}%)`).join(" dan ")} dari sisanya — itu outlier, bukan segmen pelanggan/wilayah. Silhouette ${c.silhouette.toFixed(2)} tinggi justru karena baris-baris itu sangat jauh.`,
    });
  } else if (c && c.structure !== "tidak ada") {
    const parts = c.profiles.slice(0, 3).map((g) => {
      const traits = [
        ...g.high.slice(0, 2).map((h) => `${h.column} tinggi (${fmtCol(h.column, g.centroid[h.column])})`),
        ...g.low.slice(0, 1).map((l) => `${l.column} rendah (${fmtCol(l.column, g.centroid[l.column])})`),
      ];
      const label = tiny.has(g.cluster) ? " — kemungkinan outlier" : "";
      return `Kelompok ${g.cluster} (${Math.round(g.share * 100)}%${label}): ${traits.length ? traits.join(", ") : "mendekati rata-rata"}`;
    });
    out.push({
      type: "idea",
      title: `Data terbagi jadi ${c.k} kelompok`,
      body: `${parts.join("; ")}. Pemisahan ${c.structure} (silhouette ${c.silhouette.toFixed(2)}, k-means pada ${mv.columns.length} kolom terstandardisasi).`,
    });
  }

  const p = mv.pca;
  if (p && p.bartlett.pValue < 0.05 && (p.kmo ?? 0) >= 0.6) {
    const top = p.columns
      .map((col, i) => ({ col, l: p.loadings[i][0] }))
      .filter((x) => Math.abs(x.l) >= 0.5)
      .sort((a, b) => Math.abs(b.l) - Math.abs(a.l))
      .slice(0, 4)
      .map((x) => `${x.col} (${x.l > 0 ? "+" : "−"}${Math.abs(x.l).toFixed(2)})`);
    const two = p.cumulative[Math.min(1, p.cumulative.length - 1)];
    out.push({
      type: "target",
      title: `${p.kaiserComponents || 1} dimensi utama merangkum ${p.columns.length} kolom`,
      body: `Komponen pertama menjelaskan ${(p.explained[0] * 100).toFixed(0)}% variasi${top.length ? `, didominasi ${top.join(", ")}` : ""}; dua komponen pertama ${(two * 100).toFixed(0)}%. Data layak untuk PCA (Bartlett ${formatP(p.bartlett.pValue)}, KMO ${p.kmo!.toFixed(2)} — ${kmoLabel(p.kmo!)}).`,
    });
  }
  return out;
}

export function generateKpis(analysis: Analysis, profiles: ColProfile[]): Kpi[] {
  const out: Kpi[] = [];
  const timeX = analysis.timeAxis ? resolveTimeX(profiles, analysis.timeAxis) : null;
  for (const c of analysis.kpiCandidates.slice(0, 4)) {
    const p = profiles.find((x) => x.name === c.name);
    if (!p) continue;
    const useSum = p.type === "currency" || (p.type === "integer" && Math.abs(c.total) > 1000);
    const value = useSum ? c.total : c.mean;
    const valStr = formatByType(value, p.type, p.name);
    const change = c.trend ? Math.round(c.trend.pctChange * 10) / 10 : null;

    let spark: number[] | undefined;
    if (timeX && p.numericVector) {
      const series = aggregateSeries(timeX, p.numericVector, aggregationFor(p));
      if (series.y.length >= 2) spark = systematicSample(series.y, 12);
    }

    out.push({
      label: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
      value: useSum ? `Σ ${valStr}` : valStr,
      change,
      spark,
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
    (t) => t.direction !== "datar" && Math.abs(t.pctChange) > 8,
  );
  const topCorr = analysis.correlations[0];
  const totalAnomalies = analysis.anomalies.reduce((sum, a) => sum + a.count, 0);
  const sigSegment = analysis.segments.find((s) => s.significant && s.spread > 0.4);

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
    const sentiment = t.r2 > 0.7 ? "secara konsisten" : t.r2 > 0.4 ? "meskipun fluktuatif" : "dengan naik-turun yang cukup besar";
    parts.push(
      `${mood} di ${t.column} (${t.direction === "naik" ? "+" : ""}${t.pctChange.toFixed(1)}% menurut garis tren) — pergerakan ini ${sentiment}.`,
    );
  } else if (topCorr && Math.abs(topCorr.r) > 0.6) {
    const ana = topCorr.r > 0
      ? "bergerak hampir berbarengan"
      : "bergerak berlawanan arah";
    parts.push(
      `memperlihatkan hubungan kuat antara ${topCorr.a} dan ${topCorr.b} — keduanya ${ana} (kekuatan ${topCorr.strength}).`,
    );
  } else if (sigSegment) {
    parts.push(
      `memperlihatkan ketimpangan jelas di ${sigSegment.metricCol}: ${sigSegment.topGroup.name} jauh di atas ${sigSegment.bottomGroup.name} (selisih ${(sigSegment.spread * 100).toFixed(0)}%).`,
    );
  } else if (!analysis.timeAxis) {
    parts.push(`tidak berdimensi waktu, dan belum ada hubungan atau beda kelompok yang cukup kuat untuk disimpulkan.`);
  } else {
    parts.push(`relatif stabil tanpa tren yang signifikan — naik-turunnya masih dalam batas fluktuasi wajar.`);
  }

  // Anomaly note (if significant)
  if (totalAnomalies > 0 && totalAnomalies > analysis.rowCount * 0.02) {
    parts.push(
      `Perlu diingat: ada ${totalAnomalies} titik data di luar rentang wajar — ini bisa jadi peluang investigasi atau data error yang perlu diverifikasi.`,
    );
  }

  // Forward-looking suggestion
  const forecastTrend = strongTrends.find((t) => t.forecast.length > 0 && t.forecastLower?.length);
  if (forecastTrend) {
    const p = profiles.find((x) => x.name === forecastTrend.column);
    const f = (v: number) => (p ? fmt(v, p.type, p.name) : compactNumber(v));
    parts.push(
      `Bila pola ini bertahan, ${forecastTrend.column} 3 periode ke depan diperkirakan sekitar ${f(forecastTrend.forecast[2])} (rentang 95%: ${f(forecastTrend.forecastLower![2])} – ${f(forecastTrend.forecastUpper![2])}).`,
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
    `${fileName} berisi ${analysis.rowCount} baris × ${profiles.length} kolom (${analysis.numericCols.length} numerik, ${analysis.categoricalCols.length} kategorikal${analysis.dateCols.length ? `, ${analysis.dateCols.length} waktu` : ""}).`,
  );

  if (!analysis.timeAxis) {
    parts.push("Tidak ada kolom waktu — tren tidak dihitung.");
  }

  if (intent && intent.focusValues.length > 0) {
    parts.push(`Filter aktif: ${intent.focusValues.join(", ")} di kolom ${intent.focusValueColumns.join(", ")}.`);
  }

  const strongTrend = analysis.trends.find((t) => t.direction !== "datar" && Math.abs(t.pctChange) > 5);
  if (strongTrend) {
    parts.push(
      `Sinyal utama: ${strongTrend.column} ${strongTrend.direction} ${Math.abs(strongTrend.pctChange).toFixed(1)}% (${formatP(strongTrend.pValue ?? 1)}).`,
    );
  } else if (analysis.correlations.length > 0) {
    const c = analysis.correlations[0];
    parts.push(`Hubungan paling menonjol: ${c.a} ↔ ${c.b} (r=${c.r.toFixed(2)}, ${c.strength}).`);
  } else if (analysis.anomalies.length > 0) {
    const a = analysis.anomalies[0];
    parts.push(`Terdeteksi ${a.count} nilai tidak biasa di kolom ${a.column}.`);
  }

  const totalAnomalies = analysis.anomalies.reduce((a, b) => a + b.count, 0);
  if (totalAnomalies > 0 && !parts[parts.length - 1].includes("tidak biasa")) {
    parts.push(`Total ${totalAnomalies} outlier statistik (di luar 1,5×IQR).`);
  }

  return parts.join(" ");
}
