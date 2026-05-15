import { NextRequest, NextResponse } from "next/server";
import { callWithFallback, CHAINS, type ChatMsg } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

type DatasetCtx = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  domain?: string;
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
  sample?: Record<string, unknown>[];
  insights?: { type: string; title: string; body: string }[];
};

const SYSTEM_BASE = `Kamu Grafio AI Copilot — asisten analitik data berbahasa Indonesia.
- Jawab singkat & langsung (max 4 kalimat kecuali user minta detail).
- WAJIB rujuk nama kolom + angka spesifik dari konteks dataset.
- Jika user tanya "data ini tentang apa", deskripsikan domain data berdasar nama kolom + sample (mis. "Ini data demografi negara: GDP, populasi, harapan hidup, dst").
- Jika pertanyaan butuh perhitungan eksak (top N, korelasi, filter spesifik), arahkan: "Untuk hitungan eksak coba: 'top 5 berdasarkan X', 'rata-rata X'".
- Jangan halusinasi angka yang tidak ada di konteks. Bila ragu, bilang "belum bisa pastikan tanpa scan penuh".
- Tanpa markdown heading, kalimat natural.`;

function datasetToContext(ds: DatasetCtx): string {
  const cols = ds.columns
    .slice(0, 30)
    .map((c) => {
      const parts: string[] = [`${c.name} (${c.type}`];
      if (c.nulls != null && c.nulls > 0) parts.push(`nulls=${c.nulls}`);
      parts[parts.length - 1] += ")";
      let extra = "";
      if (c.type === "number" || c.type === "currency" || c.type === "integer" || c.type === "percentage") {
        if (c.min != null && c.max != null) extra += ` range=${c.min}..${c.max}`;
        if (c.mean != null) extra += ` mean=${typeof c.mean === "number" ? c.mean.toFixed(2) : c.mean}`;
      } else if (c.type === "date") {
        if (c.min && c.max) extra += ` from=${c.min} to=${c.max}`;
      } else if (c.topValues?.length) {
        extra += ` top=${c.topValues
          .slice(0, 3)
          .map((t) => `${t.value}(${t.count})`)
          .join(", ")}`;
      }
      return `- ${parts.join(" ")}${extra}`;
    })
    .join("\n");

  const sampleStr =
    ds.sample && ds.sample.length
      ? ds.sample
          .slice(0, 5)
          .map((r) => JSON.stringify(r))
          .join("\n")
      : "(sample tidak disertakan)";

  const insightsStr =
    ds.insights && ds.insights.length
      ? ds.insights
          .slice(0, 4)
          .map((i) => `- [${i.type}] ${i.title}: ${i.body}`)
          .join("\n")
      : "";

  return `Dataset aktif: ${ds.fileName}
Domain terdeteksi: ${ds.domain ?? "tidak diketahui"}
Ukuran: ${ds.rowCount} baris × ${ds.columnCount} kolom

Kolom (${ds.columns.length}):
${cols}

Sample 5 baris:
${sampleStr}
${
  insightsStr
    ? `\nInsight yang sudah dihitung engine:\n${insightsStr}`
    : ""
}`;
}

export async function POST(req: NextRequest) {
  let body: { messages: ChatMsg[]; dataset?: DatasetCtx | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || !body.messages.length) {
    return NextResponse.json({ error: "messages kosong" }, { status: 400 });
  }

  const system = body.dataset
    ? `${SYSTEM_BASE}\n\n${datasetToContext(body.dataset)}`
    : `${SYSTEM_BASE}\n\nBelum ada dataset aktif. Minta user upload data dulu.`;

  try {
    const { text, model } = await callWithFallback(CHAINS.chat, {
      messages: [{ role: "system", content: system }, ...body.messages],
      temperature: 0.6,
      maxTokens: 700,
    });
    return NextResponse.json({ reply: text.trim(), model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
