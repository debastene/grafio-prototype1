/**
 * Unified AI enrichment endpoint. Single API surface, multiple modes
 * so we can iterate prompts without spinning up new routes.
 *
 *   mode=clarify   → after quickInspect, AI menjelaskan dataset + saran prompt + cleaning advice
 *   mode=narrate   → after engine analysis, AI menulis ulang summary/insights/kpis pakai angka engine
 *   mode=chart     → user klik "Jelaskan chart ini" → AI bercerita tentang 1 chart
 *   mode=followup  → setelah chat reply, generate 3 pertanyaan lanjutan kontekstual
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

const SYS_NARRATE = `Kamu Grafio AI — analis data senior berbahasa Indonesia.
Tugas: engine sudah menghitung statistik. Tugasmu menulis NARASI yang spesifik, kontekstual, dan actionable.
Output JSON murni:
{
  "summary": "3-4 kalimat executive summary. Sebut domain, temuan utama dengan angka, satu rekomendasi.",
  "insights": [
    { "type": "trend"|"anomaly"|"target"|"idea", "title": "<8 kata>", "body": "1-2 kalimat dgn angka spesifik dari engine, max 220 char" }
  ],
  "kpiCommentary": [
    { "label": "<nama kpi>", "comment": "1 kalimat kenapa ini penting / apa artinya" }
  ]
}
Aturan:
- 4-5 insights, type berbeda-beda. Kalau engine kasih trends/correlations/anomalies, WAJIB dipakai (jangan abaikan).
- Sebut angka eksak dari data engine (mean, korelasi r, persen perubahan).
- Bahasa Indonesia natural, bukan kaku.
- Tidak boleh halusinasi angka di luar yang engine kasih.`;

const SYS_CHART = `Kamu Grafio AI. User klik "Jelaskan chart ini".
Tugas: dalam 3-4 kalimat Bahasa Indonesia natural, jelaskan:
1. Chart ini menampilkan apa (sebut sumbu, label).
2. Apa pola/temuan utamanya (sebut angka eksak: peak, valley, growth %).
3. Apa implikasi/aksi yang bisa diambil.
Jangan pakai bullet. Tulis sebagai paragraf padat. Maks 600 karakter.`;

const SYS_FOLLOWUP = `Kamu Grafio AI. User baru saja dapat jawaban tentang dataset mereka.
Tugas: hasilkan 3 pertanyaan lanjutan yang RELEVAN dengan percakapan terakhir + kolom dataset yang ada.
Output JSON murni: { "questions": ["q1", "q2", "q3"] }
Aturan: pertanyaan pendek (<10 kata), Bahasa Indonesia natural, sebut nama kolom asli, beragam jenis (drill-down, comparison, anomaly).`;

const SYS_REPORT = `Kamu Grafio AI — analis data senior berbahasa Indonesia menulis bagian PDF report.
Tugas: hasilkan narasi eksekutif PANJANG yang siap dicetak di PDF + 4 rekomendasi strategis.
Output JSON murni:
{
  "narrative": "3-4 paragraf (~150-220 kata total) Bahasa Indonesia formal-natural. Paragraf 1: konteks domain + temuan utama. Paragraf 2: pola/anomali penting dengan angka spesifik dari engine. Paragraf 3: implikasi bisnis. Paragraf 4 (opsional): catatan keterbatasan data.",
  "recommendations": [
    { "title": "<8 kata>", "action": "1 kalimat aksi konkret", "rationale": "1-2 kalimat alasan berbasis angka data", "impact": "low|medium|high" }
  ]
}
Aturan:
- 4 rekomendasi, prioritas dari high impact.
- WAJIB sebut angka eksak dari engine (jangan halusinasi).
- Narasi mengalir natural, bukan bullet, bukan markdown.
- Bahasa siap presentasi ke direksi/klien.`;

// ============================================================
// HANDLER
// ============================================================

type Mode = "clarify" | "narrate" | "chart" | "followup" | "report";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode as Mode;
  if (!["clarify", "narrate", "chart", "followup", "report"].includes(mode)) {
    return NextResponse.json({ error: "mode tidak valid" }, { status: 400 });
  }

  try {
    let result: unknown;
    if (mode === "clarify") result = await doClarify(body);
    else if (mode === "narrate") result = await doNarrate(body);
    else if (mode === "chart") result = await doChart(body);
    else if (mode === "followup") result = await doFollowup(body);
    else if (mode === "report") result = await doReport(body);
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
