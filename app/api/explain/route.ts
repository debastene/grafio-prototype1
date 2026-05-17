/**
 * Unified AI enrichment endpoint. Single API surface, multiple modes
 * so we can iterate prompts without spinning up new routes.
 *
 *   mode=clarify        → after quickInspect, AI menjelaskan dataset + saran prompt + cleaning advice
 *   mode=narrate        → after engine analysis, AI menulis ulang summary/insights/kpis pakai angka engine
 *   mode=chart          → user klik "Jelaskan chart ini" → AI bercerita tentang 1 chart
 *   mode=followup       → setelah chat reply, generate 3 pertanyaan lanjutan kontekstual
 *   mode=rename         → AI sarankan nama kolom yang lebih friendly untuk file download
 *   mode=chart-insights → batch: AI generate 1-3 kalimat insight untuk N chart sekaligus
 */

import { NextRequest, NextResponse } from "next/server";
import { callWithFallback, CHAINS, safeParseJSON } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================================
// SYSTEM PROMPTS (per mode)
// ============================================================

const SYS_CLARIFY = `Kamu Grafio AI — analis data senior berbahasa Indonesia.
Tugas: setelah user upload file, BACA cepat schema + 5 sample row. Lalu output JSON murni:
{
  "understanding": "1-2 kalimat: ini data apa, sumber kemungkinan apa. Spesifik sebut nama domain/industri.",
  "keyColumns": ["kolom paling penting"],
  "suggestedPrompts": ["3-4 pertanyaan analisis spesifik dgn nama kolom asli"],
  "cleaningAdvice": [
    { "column": "<nama>", "issue": "<masalah ringkas>", "recommendation": "<saran konkret 1 kalimat>" }
  ],
  "warnings": ["catatan kalau ada data quality issue serius, kosongkan jika tidak"]
}
Aturan: rujuk nama kolom + angka NYATA dari sample. Jangan halusinasi. Maks 4 cleaningAdvice, 3 warnings.`;

const SYS_NARRATE = `Kamu Grafio AI — analis data senior berbahasa Indonesia yang menjelaskan ke orang awam.
Engine sudah menghitung statistik. Tugasmu menulis narasi yang BISA DIPAHAMI ORANG NON-STATISTIK,
spesifik, kontekstual, dan actionable.

GAYA BAHASA (WAJIB IKUTI):
- Gunakan bahasa sehari-hari, BUKAN jargon statistik. Hindari "regresi", "p-value", "deviasi standar" kecuali sangat perlu.
- Jelaskan dengan analogi kalau angka teknis tidak terhindarkan:
   * "korelasi r=0.85" → "saat satu naik, yang lain hampir pasti ikut naik — seperti tinggi badan & berat badan"
   * "outlier z-score 3.5" → "nilai ini jauh dari kerumunan, seperti satu pohon yang tingginya 3× pohon lain di hutan"
   * "R²=0.7" → "pola ini cukup konsisten — 7 dari 10 perubahan bisa dijelaskan trennya"
- Pakai bahasa sentimen pasar / kehidupan sehari-hari: "lonjakan", "lesu", "panas", "momentum", "ramai", "sepi".
- Sebut angka eksak dari engine (jangan halusinasi), tapi BUNGKUS dengan penjelasan manusiawi.

Output JSON murni:
{
  "summary": "3-5 kalimat executive summary. Pakai bahasa awam. Sebut domain, temuan utama (angka), satu rekomendasi konkret.",
  "conclusion": "1-2 kalimat KESIMPULAN AI SENDIRI berdasarkan dataset — bukan ringkasan, melainkan pendapatmu tentang apa yang sebenarnya terjadi di data ini. Boleh hipotetis ('kemungkinan besar…'), boleh provocative ('ini mengindikasikan momentum…').",
  "insights": [
    { "type": "trend"|"anomaly"|"target"|"idea", "title": "<8 kata, bahasa awam>", "body": "1-2 kalimat dgn angka + analogi/penjelasan manusiawi, max 240 char" }
  ],
  "kpiCommentary": [
    { "label": "<nama kpi>", "comment": "1 kalimat kenapa ini penting untuk bisnis/kehidupan user — bukan definisi teknis" }
  ]
}

Aturan tambahan:
- 4-5 insights, type berbeda-beda. Kalau engine kasih trends/correlations/anomalies, WAJIB dipakai.
- Sebut nama kolom asli dari data.
- Conclusion HARUS punya sudut pandang, bukan generic.
- Bahasa Indonesia natural, bukan kaku, bukan formal-pejabat.
- Tidak boleh halusinasi angka di luar yang engine kasih.`;

const SYS_CHART = `Kamu Grafio AI. User klik "Jelaskan chart ini" — mereka mungkin awam soal statistik.
Tugas: dalam 3-4 kalimat Bahasa Indonesia natural & santai, jelaskan:
1. Chart ini menampilkan apa (sebut sumbu, label — dengan bahasa sehari-hari).
2. Apa pola/temuan utamanya — sebut angka eksak (peak, valley, growth %) TAPI bungkus dengan analogi atau metafora kehidupan sehari-hari supaya orang non-statistik paham.
3. Apa implikasi/aksi yang bisa diambil — bahasa konkret, bukan teori.

Hindari jargon. Pakai bahasa pasar/sentimen ("lonjakan", "lesu", "panas", "momentum naik", dst).
Jangan pakai bullet atau heading. Tulis sebagai paragraf padat. Maks 700 karakter.`;

const SYS_CHART_INSIGHTS = `Kamu Grafio AI — analis data senior berbahasa Indonesia.
Tugas: untuk SETIAP chart yang diberikan, tulis insight ringkas 1-3 KALIMAT dalam Bahasa Indonesia
yang menjelaskan chart tersebut "mengartikan apa" dari sudut pandang user awam.

Aturan WAJIB:
- 1-3 kalimat per chart. Singkat, padat, kontekstual.
- Sebut angka EKSAK dari data yang diberikan (jangan halusinasi).
- Bahasa sehari-hari, BUKAN jargon statistik. Hindari "regresi", "p-value", "deviasi".
- Pakai analogi/bahasa pasar bila perlu: "lonjakan", "lesu", "panas", "ramai", "sepi", "momentum".
- Fokus ke "apa artinya buat user", bukan "ini chart apa".
- Kalau data terlalu generic untuk diberi insight bermakna, output "Chart ini menunjukkan distribusi {nama} — pola dasar sesuai ekspektasi."

Output JSON murni:
{
  "insights": {
    "<chart-id>": "<insight 1-3 kalimat>",
    "<chart-id>": "<insight 1-3 kalimat>"
  }
}
Pastikan setiap chart-id yang diminta ADA di output. Tidak ada field tambahan.`;

const SYS_RENAME = `Kamu Grafio AI — pakar penamaan kolom data. User akan download data hasil cleaning.
Tugas: berdasarkan daftar nama kolom asli + sample 3 baris, sarankan nama kolom yang LEBIH FRIENDLY
& mudah dipahami orang awam, tapi tetap informatif. Hanya rename yang BENAR-BENAR perlu (nama kurang jelas,
singkatan ambigu, snake_case acak, dsb). Kalau nama asli sudah bagus, KEMBALIKAN nama yang sama.

Aturan penamaan:
- Gunakan snake_case lowercase (mis. "tanggal_transaksi", "harga_satuan", "jumlah_pesanan").
- Singkat tapi jelas: 1-3 kata, maksimum 24 karakter.
- Bahasa Indonesia kalau domain Indonesia, Inggris kalau domain global.
- Jangan ubah nama yang sudah jelas seperti "email", "phone", "country", "price", "date".
- Jangan tambahkan unit di nama kolom (jangan "harga_rp"; cukup "harga").

Output JSON murni:
{
  "renames": [
    { "original": "<nama asli>", "suggested": "<nama baru>", "reason": "<<=10 kata kenapa>" }
  ]
}

Aturan tambahan:
- Sertakan SEMUA kolom (bahkan yang tidak di-rename — set suggested = original, reason = "sudah jelas").
- Jangan halusinasi: kalau ragu, biarkan nama asli.`;

const SYS_FOLLOWUP = `Kamu Grafio AI. User baru saja dapat jawaban tentang dataset mereka.
Tugas: hasilkan 3 pertanyaan lanjutan yang RELEVAN dengan percakapan terakhir + kolom dataset yang ada.

Output JSON murni: { "questions": ["q1", "q2", "q3"] }

Aturan:
- Pertanyaan pendek (<12 kata), Bahasa Indonesia natural seperti orang bertanya santai.
- Sebut nama kolom asli dari dataset.
- Beragam jenis: drill-down ("kenapa di bulan X melonjak?"), comparison ("bandingkan A vs B"), root-cause ("apa penyebab anomali di X?"), what-if ("kalau X naik 10% efeknya ke Y?").
- Pertanyaan harus menggali lebih dalam — jangan ulang yang sudah dijawab.
- HINDARI pertanyaan generic seperti "apa lagi yang bisa dilihat" — selalu spesifik ke kolom/angka.`;

const SYS_REPORT = `Kamu Grafio AI — analis data senior berbahasa Indonesia menulis bagian PDF report.
Audiens: campuran direksi/non-teknis. Bahasa harus profesional TAPI mudah dipahami orang awam.
Hindari jargon statistik telanjang — bungkus dengan analogi atau bahasa sentimen pasar.

Output JSON murni:
{
  "narrative": "3-4 paragraf (~180-260 kata total) Bahasa Indonesia formal-natural. Paragraf 1: konteks domain + temuan utama dengan angka. Paragraf 2: pola/anomali penting — sebut angka eksak TAPI jelaskan artinya dalam bahasa awam ('korelasi 0.85 artinya hampir bergerak bareng, seperti tinggi & berat'). Paragraf 3: implikasi bisnis konkret + kesimpulan AI sendiri (sudut pandang, bukan ringkasan ulang). Paragraf 4 (opsional): catatan keterbatasan data.",
  "recommendations": [
    { "title": "<8 kata>", "action": "1 kalimat aksi konkret", "rationale": "1-2 kalimat alasan berbasis angka data — jelaskan dengan bahasa awam", "impact": "low|medium|high" }
  ]
}
Aturan:
- 4 rekomendasi, prioritas dari high impact.
- WAJIB sebut angka eksak dari engine (jangan halusinasi).
- Narasi mengalir natural, bukan bullet, bukan markdown.
- Gunakan bahasa sentimen ("lonjakan", "lesu", "momentum", "ramai", "sepi") supaya hidup.
- Bahasa siap presentasi ke direksi DAN orang lapangan yang non-teknis.`;

// ============================================================
// HANDLER
// ============================================================

type Mode = "clarify" | "narrate" | "chart" | "followup" | "report" | "rename" | "chart-insights";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode as Mode;
  if (!["clarify", "narrate", "chart", "followup", "report", "rename", "chart-insights"].includes(mode)) {
    return NextResponse.json({ error: "mode tidak valid" }, { status: 400 });
  }

  try {
    let result: unknown;
    if (mode === "clarify") result = await doClarify(body);
    else if (mode === "narrate") result = await doNarrate(body);
    else if (mode === "chart") result = await doChart(body);
    else if (mode === "followup") result = await doFollowup(body);
    else if (mode === "report") result = await doReport(body);
    else if (mode === "rename") result = await doRename(body);
    else if (mode === "chart-insights") result = await doChartInsights(body);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================
// MODE IMPLEMENTATIONS
// ============================================================

async function doClarify(body: Record<string, unknown>) {
  const inspection = body.inspection as {
    fileName: string;
    rowCount: number;
    headers: string[];
    domain: { name: string; description: string };
    preview: { rows: unknown[][] };
    profile: { name: string; type: string; missingPct: number }[];
  };

  const cols = inspection.profile
    .slice(0, 15)
    .map(
      (p) =>
        `${p.name} (${p.type}${p.missingPct > 0 ? `, ${(p.missingPct * 100).toFixed(0)}% kosong` : ""})`,
    )
    .join(", ");

  const sample = inspection.preview.rows
    .slice(0, 3)
    .map((r) => JSON.stringify(r))
    .join("\n");

  const userMsg = `File: ${inspection.fileName}
Engine detected domain: ${inspection.domain.name}
Ukuran: ${inspection.rowCount} baris × ${inspection.headers.length} kolom
Kolom: ${cols}
Sample 5 baris:
${sample}`;

  const { text, model } = await callWithFallback(CHAINS.structured, {
    messages: [
      { role: "system", content: SYS_CLARIFY },
      { role: "user", content: userMsg },
    ],
    temperature: 0.3,
    maxTokens: 600,
    timeoutMs: 8000,
    responseFormat: "json_object",
  });
  return { ...safeParseJSON<Record<string, unknown>>(text), _model: model };
}

async function doNarrate(body: Record<string, unknown>) {
  const ctx = body.context as {
    fileName: string;
    rowCount: number;
    domain: string;
    userPrompt?: string;
    userContext?: string;
    columns: { name: string; type: string; mean?: number; min?: number; max?: number }[];
    trends?: { column: string; direction: string; pctChange: number; r2: number; startValue: number; endValue: number }[];
    correlations?: { a: string; b: string; r: number; direction: string; strength: string }[];
    anomalies?: { column: string; count: number; topZscore?: number }[];
    kpis?: { label: string; value: string; change: number }[];
    sample?: Record<string, unknown>[];
  };

  const colsStr = ctx.columns
    .slice(0, 20)
    .map((c) => {
      const stats =
        c.mean != null && c.min != null && c.max != null
          ? ` [min=${c.min} max=${c.max} mean=${typeof c.mean === "number" ? c.mean.toFixed(2) : c.mean}]`
          : "";
      return `- ${c.name} (${c.type})${stats}`;
    })
    .join("\n");

  const sections: string[] = [
    `Dataset: ${ctx.fileName} (${ctx.rowCount} baris)`,
    `Domain: ${ctx.domain}`,
    ctx.userContext ? `\n[KONTEKS USER — PENTING] User memberi konteks: "${ctx.userContext}"\nGunakan konteks ini untuk membingkai narasi. Kalau ada hal di data yang "tampak anomali" tapi dijelaskan oleh konteks user, jangan flag sebagai masalah.` : "",
    ctx.userPrompt ? `Arahan user: "${ctx.userPrompt}"` : "",
    "",
    "Kolom + statistik dari engine:",
    colsStr,
  ];

  if (ctx.trends?.length) {
    sections.push(
      "\nTrends terdeteksi engine:",
      ctx.trends
        .slice(0, 5)
        .map(
          (t) =>
            `- ${t.column}: ${t.direction} ${t.pctChange.toFixed(1)}% (${t.startValue} → ${t.endValue}, R²=${t.r2.toFixed(2)})`,
        )
        .join("\n"),
    );
  }
  if (ctx.correlations?.length) {
    sections.push(
      "\nKorelasi terdeteksi engine:",
      ctx.correlations
        .slice(0, 5)
        .map((c) => `- ${c.a} × ${c.b}: r=${c.r.toFixed(3)} (${c.direction}, ${c.strength})`)
        .join("\n"),
    );
  }
  if (ctx.anomalies?.length) {
    sections.push(
      "\nAnomalies terdeteksi engine:",
      ctx.anomalies
        .slice(0, 5)
        .map((a) => `- ${a.column}: ${a.count} outlier${a.topZscore ? ` (top z=${a.topZscore.toFixed(2)})` : ""}`)
        .join("\n"),
    );
  }
  if (ctx.kpis?.length) {
    sections.push(
      "\nKPI engine:",
      ctx.kpis.map((k) => `- ${k.label}: ${k.value} (Δ${k.change}%)`).join("\n"),
    );
  }
  if (ctx.sample?.length) {
    sections.push(
      "\nSample 5 baris:",
      ctx.sample.slice(0, 5).map((r) => JSON.stringify(r)).join("\n"),
    );
  }

  const userMsg = sections.filter(Boolean).join("\n");

  const { text, model } = await callWithFallback(CHAINS.reasoning, {
    messages: [
      { role: "system", content: SYS_NARRATE },
      { role: "user", content: userMsg },
    ],
    temperature: 0.4,
    maxTokens: 1200,
    timeoutMs: 18000,
    responseFormat: "json_object",
  });
  return { ...safeParseJSON<Record<string, unknown>>(text), _model: model };
}

async function doChart(body: Record<string, unknown>) {
  const ctx = body.context as {
    chartType: string;
    chartTitle: string;
    chartDescription?: string;
    labels?: string[];
    datasets?: { label: string; data: (number | { x: number; y: number; r?: number })[] }[];
    domain?: string;
  };

  const dataStr = ctx.datasets
    ?.map((d) => {
      const arr = d.data.slice(0, 12);
      return `- ${d.label}: ${arr.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join(", ")}`;
    })
    .join("\n");

  const userMsg = `Chart type: ${ctx.chartType}
Title: ${ctx.chartTitle}
${ctx.chartDescription ? `Konteks: ${ctx.chartDescription}` : ""}
${ctx.domain ? `Domain data: ${ctx.domain}` : ""}
${ctx.labels?.length ? `\nLabels (x-axis): ${ctx.labels.slice(0, 12).join(", ")}` : ""}
${dataStr ? `\nData:\n${dataStr}` : ""}

Jelaskan chart ini.`;

  const { text, model } = await callWithFallback(CHAINS.chat, {
    messages: [
      { role: "system", content: SYS_CHART },
      { role: "user", content: userMsg },
    ],
    temperature: 0.5,
    maxTokens: 350,
    timeoutMs: 8000,
  });
  return { explanation: text.trim(), _model: model };
}

async function doReport(body: Record<string, unknown>) {
  const ctx = body.context as {
    fileName: string;
    rowCount: number;
    domain: string;
    summary?: string;
    columns: { name: string; type: string; mean?: number; min?: number; max?: number }[];
    trends?: { column: string; direction: string; pctChange: number; r2: number }[];
    correlations?: { a: string; b: string; r: number; strength: string }[];
    anomalies?: { column: string; count: number }[];
    kpis?: { label: string; value: string; change: number }[];
    insights?: { type: string; title: string; body: string }[];
  };

  const sections: string[] = [
    `Dataset: ${ctx.fileName} (${ctx.rowCount} baris)`,
    `Domain: ${ctx.domain}`,
    ctx.summary ? `\nRingkasan engine: ${ctx.summary}` : "",
    "",
    "Kolom utama:",
    ctx.columns
      .slice(0, 12)
      .map((c) => `- ${c.name} (${c.type})${c.mean != null ? ` mean=${typeof c.mean === "number" ? c.mean.toFixed(2) : c.mean}` : ""}`)
      .join("\n"),
  ];

  if (ctx.trends?.length) {
    sections.push(
      "\nTrends:",
      ctx.trends.slice(0, 4).map((t) => `- ${t.column}: ${t.direction} ${t.pctChange.toFixed(1)}% (R²=${t.r2.toFixed(2)})`).join("\n"),
    );
  }
  if (ctx.correlations?.length) {
    sections.push(
      "\nKorelasi top:",
      ctx.correlations.slice(0, 4).map((c) => `- ${c.a} × ${c.b}: r=${c.r.toFixed(3)} (${c.strength})`).join("\n"),
    );
  }
  if (ctx.anomalies?.length) {
    sections.push(
      "\nAnomalies:",
      ctx.anomalies.slice(0, 4).map((a) => `- ${a.column}: ${a.count} outlier`).join("\n"),
    );
  }
  if (ctx.kpis?.length) {
    sections.push(
      "\nKPI:",
      ctx.kpis.map((k) => `- ${k.label}: ${k.value} (Δ${k.change}%)`).join("\n"),
    );
  }
  if (ctx.insights?.length) {
    sections.push(
      "\nInsight pendek:",
      ctx.insights.slice(0, 4).map((i) => `- [${i.type}] ${i.title}: ${i.body}`).join("\n"),
    );
  }

  const userMsg = sections.filter(Boolean).join("\n");

  const { text, model } = await callWithFallback(CHAINS.reasoning, {
    messages: [
      { role: "system", content: SYS_REPORT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.4,
    maxTokens: 1400,
    timeoutMs: 18000,
    responseFormat: "json_object",
  });
  return { ...safeParseJSON<Record<string, unknown>>(text), _model: model };
}

async function doFollowup(body: Record<string, unknown>) {
  const ctx = body.context as {
    lastQuestion: string;
    lastAnswer: string;
    columns?: string[];
    domain?: string;
  };

  const userMsg = `Pertanyaan terakhir user: "${ctx.lastQuestion}"
Jawaban AI: "${ctx.lastAnswer.slice(0, 600)}"
Kolom yang ada: ${ctx.columns?.slice(0, 15).join(", ") ?? "(unknown)"}
${ctx.domain ? `Domain: ${ctx.domain}` : ""}

Generate 3 pertanyaan lanjutan.`;

  const { text } = await callWithFallback(CHAINS.chat, {
    messages: [
      { role: "system", content: SYS_FOLLOWUP },
      { role: "user", content: userMsg },
    ],
    temperature: 0.7,
    maxTokens: 250,
    timeoutMs: 6000,
    responseFormat: "json_object",
  });
  return safeParseJSON<{ questions: string[] }>(text);
}

async function doChartInsights(body: Record<string, unknown>) {
  const ctx = body.context as {
    fileName: string;
    domain?: string;
    userContext?: string;
    charts: {
      id: string;
      name: string;
      category?: string;
      labels?: (string | number)[];
      datasets?: { label: string; data: (number | { x: number; y: number; r?: number })[] }[];
    }[];
  };

  if (!Array.isArray(ctx.charts) || ctx.charts.length === 0) {
    return { insights: {} };
  }

  // Compress each chart's data (max 12 datapoints) supaya token tidak meledak
  const compressed = ctx.charts.slice(0, 10).map((c) => {
    const datasets = (c.datasets ?? []).map((d) => {
      const data = d.data.slice(0, 12);
      const peek = data.map((v) =>
        typeof v === "object" ? JSON.stringify(v) : typeof v === "number" ? Number(v.toFixed(2)) : v,
      );
      return { label: d.label, data: peek };
    });
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      labels: c.labels?.slice(0, 12),
      datasets,
    };
  });

  const userMsg = `Domain: ${ctx.domain ?? "tidak diketahui"}
File: ${ctx.fileName}
${ctx.userContext ? `\n[Konteks user]: ${ctx.userContext}` : ""}

Chart yang perlu di-insight (${compressed.length} chart):
${JSON.stringify(compressed, null, 2)}

Untuk setiap chart-id di atas, tulis insight 1-3 kalimat sesuai aturan.`;

  const { text, model } = await callWithFallback(CHAINS.structured, {
    messages: [
      { role: "system", content: SYS_CHART_INSIGHTS },
      { role: "user", content: userMsg },
    ],
    temperature: 0.45,
    maxTokens: 1200,
    timeoutMs: 18_000,
    responseFormat: "json_object",
  });
  return { ...safeParseJSON<{ insights: Record<string, string> }>(text), _model: model };
}

async function doRename(body: Record<string, unknown>) {
  const ctx = body.context as {
    headers: string[];
    domain?: string;
    sample?: unknown[][];
  };

  const sampleStr = (ctx.sample ?? [])
    .slice(0, 3)
    .map((r) => JSON.stringify(r))
    .join("\n");

  const userMsg = `Domain data: ${ctx.domain ?? "tidak diketahui"}

Daftar nama kolom asli (${ctx.headers.length} kolom):
${ctx.headers.map((h) => `- ${h}`).join("\n")}

Sample 3 baris (urut sesuai header):
${sampleStr || "(tidak ada sample)"}

Sarankan nama yang lebih friendly.`;

  const { text, model } = await callWithFallback(CHAINS.structured, {
    messages: [
      { role: "system", content: SYS_RENAME },
      { role: "user", content: userMsg },
    ],
    temperature: 0.3,
    maxTokens: 900,
    timeoutMs: 10_000,
    responseFormat: "json_object",
  });
  return { ...safeParseJSON<Record<string, unknown>>(text), _model: model };
}
