import { NextRequest, NextResponse } from "next/server";
import { callWithFallback, CHAINS, safeParseJSON } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Kamu adalah Grafio AI — analis data senior berbahasa Indonesia.
Tugasmu menganalisis SAMPLE data tabular (CSV/JSON/dll) dan menghasilkan insight spesifik berdasarkan ANGKA NYATA dari data — bukan generik.

INPUT (di user message):
- File name + metadata
- Sample data (text)
- Optional instruksi user

OUTPUT: HARUS JSON murni (tanpa markdown/code fence) dengan struktur persis:
{
  "summary": "2-3 kalimat ringkasan eksekutif Bahasa Indonesia, sebut domain data + temuan utama",
  "insights": [
    { "type": "trend"|"anomaly"|"target"|"idea", "title": "<8 kata", "body": "1-2 kalimat dgn angka spesifik (max 220 char)" }
  ],
  "kpis": [
    { "label": "<18 char", "value": "string siap tampil ex: Rp 324M / 12.8K / 3.4×", "change": <number>}
  ],
  "recommendedCharts": ["line"|"bar"|"doughnut"|"radar"|"scatter"|"bubble"|"polar"|"mixed"|"heatmap", ...]
}

ATURAN:
- Bahasa Indonesia natural.
- 4-5 insights, type harus berbeda-beda.
- 3-4 KPI, ambil dari kolom NUMERIK utama. Format Rp untuk currency, K/M/B untuk angka besar.
- 2-4 chart recommendation.
- WAJIB sebut nama kolom dan angka dari data — tidak boleh halusinasi.
- Jika data minim/binary, di summary jelaskan keterbatasan analisis.`;

export async function POST(req: NextRequest) {
  let body: { fileName?: string; dataSample?: string; prompt?: string; fileMeta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = body.fileName ?? "data.unknown";
  const dataSample = (body.dataSample ?? "").slice(0, 8000);
  const fileMeta = body.fileMeta ?? "";
  const userPrompt =
    body.prompt?.trim() ||
    "Lakukan analisis menyeluruh. Sebutkan tren utama, anomali, dan rekomendasi aksi konkret.";

  const userMessage = [
    `File: ${fileName}`,
    fileMeta ? `Metadata: ${fileMeta}` : "",
    "",
    "--- BEGIN DATA SAMPLE ---",
    dataSample || "(no sample available — binary or empty file)",
    "--- END DATA SAMPLE ---",
    "",
    `Instruksi pengguna: ${userPrompt}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await callWithFallback(CHAINS.structured, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      maxTokens: 2048,
      responseFormat: "json_object",
    });

    const parsed = safeParseJSON<Record<string, unknown>>(text);
    return NextResponse.json({
      ...parsed,
      _meta: { model, provider: "openrouter" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
