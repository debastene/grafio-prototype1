import { NextRequest, NextResponse } from "next/server";
import { callWithFallback, CHAINS, type ChatMsg } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

type DatasetCtx = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  domain?: string;
  userContext?: string;
  conclusion?: string;
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

const SYSTEM_BASE = `Kamu Grafio AI Copilot — asisten analitik data berbahasa Indonesia untuk orang AWAM (bukan data scientist).

GAYA JAWABAN (WAJIB):
- Jawab singkat & langsung (3-5 kalimat default; tambah detail hanya kalau user minta).
- WAJIB merujuk nama kolom asli + angka spesifik dari konteks dataset di tiap jawaban yang menyangkut data.
- BAHASA: sehari-hari, natural, hangat. Hindari jargon statistik telanjang.
- Saat menjelaskan konsep teknis (korelasi, outlier, rata-rata vs median, dst), pakai ANALOGI dari kehidupan sehari-hari.
   * Contoh: "korelasi 0.85 itu seperti tinggi badan vs berat badan — satu naik, yang lain hampir pasti ikut naik."
   * Contoh: "outlier itu seperti satu rumah seharga 100 milyar di kompleks rumah 500 juta — ekstrim, perlu dilihat."
- Gunakan bahasa sentimen pasar: "lonjakan", "lesu", "momentum", "panas", "lemah", "stabil".

KONTEKS-AWARENESS:
- Saat user bertanya, baca SELURUH history percakapan. Jangan ulang penjelasan yang sudah diberikan.
- Kalau user follow-up dengan kata ambigu ("itu", "kenapa", "lebih detail"), referensi balik ke jawaban sebelumnya.
- Kalau user pertanyaannya kurang jelas, MINTA KLARIFIKASI dulu — jangan asal jawab.
- Kalau user tanya "data ini tentang apa", jelaskan domain dengan bahasa natural berdasarkan nama kolom + sample
  (mis. "Ini sepertinya data toko online — ada kolom 'order_id', 'price', 'category'. Datanya 12 bulan terakhir.").
- Kalau user nyebut konteks bisnis/situasi mereka (mis. "kami baru launch produk Mei"), INGAT & integrasikan ke jawaban berikutnya.

PERHITUNGAN:
- Untuk hitungan eksak (top N, korelasi, filter), arahkan: "Coba tanya 'top 5 berdasarkan X' atau 'rata-rata X' — engine bisa hitung pasti."
- JANGAN halusinasi angka. Kalau tidak ada di konteks, bilang "belum bisa pastikan tanpa scan penuh — coba minta perhitungan spesifik."
- Bila ragu, AKUI: "saya belum yakin, mungkin perlu diperjelas."

KESIMPULAN AI:
- Kalau user minta opini ("menurut kamu…", "bagaimana", "apa kesimpulanmu"), berikan SUDUT PANDANG aktif berdasarkan data — bukan ringkasan generik. Boleh hipotetis ("kemungkinan besar…", "ini mengindikasikan…").

FORMAT: kalimat natural mengalir, tanpa heading/bullet markdown kecuali user spesifik minta list.`;

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

  const userCtxBlock = ds.userContext
    ? `\n[KONTEKS BISNIS DARI USER — PENTING DIINGAT]\n${ds.userContext}\nGunakan ini untuk membingkai SEMUA jawabanmu. Kalau user nanya soal pola data, hubungkan dengan konteks ini.`
    : "";

  const conclusionBlock = ds.conclusion
    ? `\nKesimpulan Grafio sebelumnya:\n"${ds.conclusion}"\n(Boleh dirujuk kalau user nanya soal opini menyeluruh.)`
    : "";

  return `Dataset aktif: ${ds.fileName}
Domain terdeteksi: ${ds.domain ?? "tidak diketahui"}
Ukuran: ${ds.rowCount} baris × ${ds.columnCount} kolom
${userCtxBlock}${conclusionBlock}

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
