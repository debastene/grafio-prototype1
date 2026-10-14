import { NextRequest, NextResponse } from "next/server";
import { callWithFallback, CHAINS } from "@/lib/openrouter";
import {
  aiErrorResponse,
  authorizeAi,
  consumeAiQuota,
  MAX_BODY_BYTES,
  readJsonBody,
} from "@/lib/server/aiGuard";
import { isObj, sanitizeChatDataset, sanitizeChatMessages, type ChatDataset } from "@/lib/server/aiSanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

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

FORMAT: kalimat natural mengalir, tanpa heading/bullet markdown kecuali user spesifik minta list.

PRIVASI: nilai "[disamarkan]", "[email]", "[no-hp]", "[nomor-id]", "[nomor]" adalah data pribadi yang sengaja disamarkan Grafio. Jangan menebak isinya.`;

function datasetToContext(ds: ChatDataset): string {
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
  // 1. Auth (401 kalau belum login saat Supabase aktif)
  const caller = await authorizeAi(req);
  if (caller instanceof NextResponse) return caller;

  // 2. Body dengan batas ukuran
  const parsed = await readJsonBody(req, MAX_BODY_BYTES.chat);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;
  if (!isObj(body)) return NextResponse.json({ error: "Body harus object JSON" }, { status: 400 });

  // 3. Validasi: hanya role user/assistant (tidak bisa menyuntik "system"),
  //    maks 20 pesan × 2.000 karakter, pesan terakhir dari user.
  const messages = sanitizeChatMessages(body.messages);
  if (!messages) {
    return NextResponse.json(
      { error: "messages harus berisi percakapan user/assistant dengan pesan terakhir dari user" },
      { status: 400 },
    );
  }
  const dataset = body.dataset == null ? null : sanitizeChatDataset(body.dataset);
  if (body.dataset != null && !dataset) {
    return NextResponse.json({ error: "dataset tidak valid" }, { status: 400 });
  }

  // 4. Kuota (hanya untuk request valid)
  const limited = await consumeAiQuota(caller, "chat");
  if (limited) return limited;

  const system = dataset
    ? `${SYSTEM_BASE}\n\n${datasetToContext(dataset)}`
    : `${SYSTEM_BASE}\n\nBelum ada dataset aktif. Minta user upload data dulu.`;

  try {
    const { text, model } = await callWithFallback(CHAINS.chat, {
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.6,
      maxTokens: 700,
    });
    return NextResponse.json({ reply: text.trim(), model });
  } catch (err) {
    return aiErrorResponse("api/chat", err);
  }
}
