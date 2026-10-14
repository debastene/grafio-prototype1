import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Sparkles, Bug, Zap, Shield, FileText } from "lucide-react";

export const metadata = {
  title: "Changelog — Grafio",
  description: "Riwayat update Grafio, fitur baru, dan bug fix.",
};

const releases = [
  {
    version: "v2.4.0",
    date: "14 Oktober 2026",
    headline: "Laporan PDF Multivariat",
    changes: [
      { type: "feature", text: "Laporan PDF kini memuat bab Analisis Multivariat: uji Bartlett & KMO, scree plot dengan garis Kaiser, tabel loading, proyeksi PC1 × PC2 berwarna per klaster, dan profil tiap kelompok." },
      { type: "fix", text: "Halaman PDF yang berisi tabel (mis. Profil Variabel) sebelumnya tercetak kosong — sekarang tampil utuh, dan tabel panjang tidak lagi menimpa header/footer halaman berikutnya." },
      { type: "fix", text: "Deteksi domain tidak lagi melabeli data pelanggan sebagai \"Survei & Riset\" hanya karena ada kolom rating — kata ambigu (rating, nilai, harga, usia) kini berbobot setengah." },
      { type: "security", text: "Kuis sepenuhnya lewat fungsi database yang aman; jalur lama yang membaca tabel kuis langsung sudah dihapus." },
    ],
  },
  {
    version: "v2.3.0",
    date: "14 Oktober 2026",
    headline: "Analisis Multivariat: PCA & Klaster",
    changes: [
      { type: "feature", text: "PCA dari matriks korelasi: scree plot, tabel loading, proyeksi PC1 × PC2 — didahului uji kelayakan Bartlett & KMO." },
      { type: "feature", text: "Klaster k-means++ (seed tetap, hasil deterministik) dengan k dipilih lewat silhouette; profil tiap kelompok ditulis dalam bahasa awam." },
      { type: "improvement", text: "Kolom yang sangat miring (populasi, omzet) di-log sebelum analisis; kelompok < 5% ditandai sebagai kemungkinan outlier, bukan segmen." },
      { type: "feature", text: "Chat engine menjawab pertanyaan \"ada berapa klaster?\" dan \"hasil PCA?\" langsung dari hasil hitungan." },
    ],
  },
  {
    version: "v2.2.0",
    date: "14 Oktober 2026",
    headline: "Next.js 15 & Rate Limit Global",
    changes: [
      { type: "improvement", text: "Upgrade ke Next.js 15.5 + React 19 — menutup advisory keamanan Next.js 14 yang tersisa (npm audit: 0 kerentanan di dependency produksi)." },
      { type: "improvement", text: "Rate limit fitur AI bisa memakai Upstash Redis sehingga kuota berlaku global di semua server, bukan per instance." },
      { type: "improvement", text: "Hero landing tampil tanpa menunggu JavaScript selesai dimuat (animasi CSS murni)." },
      { type: "fix", text: "Password minimal 8 karakter." },
      { type: "fix", text: "Testimoni karangan yang mencatut nama perusahaan diganti contoh skenario penggunaan; statistik landing hanya angka yang bisa diverifikasi." },
    ],
  },
  {
    version: "v2.1.0",
    date: "12 Oktober 2026",
    headline: "Audit Keamanan & Ketepatan Statistik",
    changes: [
      { type: "fix", text: "Keamanan database: user tidak bisa lagi mengubah plan/credits sendiri; kunci jawaban kuis tidak lagi terkirim ke browser; penilaian kuis & pemberian credits terjadi atomik di server." },
      { type: "fix", text: "Fitur AI wajib login; payload divalidasi & dibatasi ukurannya; error upstream tidak lagi diteruskan mentah ke browser." },
      { type: "feature", text: "Privasi: nama, email, no HP, NIK, alamat disamarkan otomatis di browser sebelum sampel data dikirim ke provider AI." },
      { type: "improvement", text: "Tren hanya dihitung bila ada kolom waktu, diagregasi per periode, diuji signifikansinya (p-value), dan forecast disertai rentang 95%." },
      { type: "improvement", text: "Korelasi diuji + dikoreksi Benjamini-Hochberg; outlier memakai pagar IQR & modified z-score; variansi memakai pembagi n−1." },
      { type: "fix", text: "Tanggal DD/MM/YYYY & nama bulan Indonesia terbaca benar; kolom seperti GDP, populasi, 'paid_amount', 'humidity' tidak lagi salah dianggap ID." },
      { type: "fix", text: "Klarifikasi: format yang didukung CSV, TSV, TXT, JSON, JSONL (maks 5 MB). Klaim Excel/Parquet/50 MB/enkripsi end-to-end di versi sebelumnya tidak akurat dan sudah dihapus." },
    ],
  },
  {
    version: "v2.0.0",
    date: "14 Mei 2026",
    headline: "Full AI Copilot",
    changes: [
      { type: "feature", text: "Pipeline AI penuh: clarification step + narasi AI di insight + chatbot follow-up suggestions + 'Jelaskan chart ini' on-demand." },
      { type: "feature", text: "PDF Report sekarang berisi narasi eksekutif AI (3-4 paragraf) + 4-6 rekomendasi strategis dengan impact ranking." },
      { type: "feature", text: "Logo Grafio Ver 2 official terpasang di Nav, Footer, Auth pages, dan PDF report." },
      { type: "improvement", text: "OpenRouter chain diperluas ke 8 provider berbeda — fallback otomatis kalau salah satu rate-limited." },
      { type: "fix", text: "Chatbot tidak lagi auto-scroll halaman ke bawah setelah reply (scroll terisolasi ke container chat)." },
      { type: "fix", text: "Tombol 'Lanjutkan dengan Analisis' di-disable selama AI baca data — mencegah klik prematur." },
    ],
  },
  {
    version: "v1.5.0",
    date: "20 Maret 2026",
    headline: "OpenRouter Integration",
    changes: [
      { type: "feature", text: "Switch dari Claude API ke OpenRouter free-tier (Qwen3-next, Nemotron-3, GPT-OSS, Llama 3.3)." },
      { type: "feature", text: "Endpoint terpadu /api/explain dengan 5 mode: clarify, narrate, chart, followup, report." },
      { type: "improvement", text: "Per-call timeout 10s + hard-stop client 20-30s — tidak ada lagi loading berkepanjangan." },
    ],
  },
  {
    version: "v1.2.0",
    date: "10 Februari 2026",
    headline: "Engine Statistik Komplet",
    changes: [
      { type: "feature", text: "Engine OLS regression + Pearson correlation + Z-score outlier detection (100% client-side)." },
      { type: "feature", text: "Domain detection: 24 jenis dataset (sales, finance, demografi, kesehatan, dst)." },
      { type: "feature", text: "Auto data cleaning dengan health score 0-100." },
      { type: "improvement", text: "PDF magazine-style dengan 6 section + cover page." },
    ],
  },
  {
    version: "v1.0.0",
    date: "15 Januari 2026",
    headline: "Public Launch",
    changes: [
      { type: "feature", text: "Upload data (CSV, Excel, JSON, Parquet, dll, max 50MB)." },
      { type: "feature", text: "9 chart type: Line, Bar, Doughnut, Radar, Polar, Scatter, Bubble, Mixed, Heatmap." },
      { type: "feature", text: "Magazine-style dashboard dengan dark theme." },
      { type: "feature", text: "Auto-detect format angka ID (1.234,56) vs EN (1,234.56)." },
    ],
  },
];

const ICONS: Record<string, { Icon: typeof Sparkles; color: string }> = {
  feature: { Icon: Sparkles, color: "text-cyan" },
  improvement: { Icon: Zap, color: "text-mint" },
  fix: { Icon: Bug, color: "text-warning" },
  security: { Icon: Shield, color: "text-purple" },
};

const TYPE_LABEL: Record<string, string> = {
  feature: "NEW",
  improvement: "IMPROVED",
  fix: "FIXED",
  security: "SECURITY",
};

export default function Changelog() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 bg-grad-hero opacity-50 pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-6 py-24">
        <div className="reveal">
        <SectionHeader
          eyebrow="Changelog"
          title="Apa yang baru di Grafio"
          description="Update fitur, perbaikan, dan optimasi — biasanya rilis tiap 2-4 minggu."
        />
        </div>

        <div className="space-y-10">
          {releases.map((r) => (
            <div key={r.version} className="reveal">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-syne font-bold text-white text-2xl">{r.version}</h2>
                  <span className="text-cyan font-semibold text-sm">{r.headline}</span>
                </div>
                <span className="text-xs font-mono text-muted uppercase tracking-widest">{r.date}</span>
              </div>

              <Card>
                <ul className="space-y-3">
                  {r.changes.map((c, i) => {
                    const meta = ICONS[c.type] ?? ICONS.feature;
                    const Icon = meta.Icon;
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold flex-shrink-0 mt-0.5 ${meta.color} bg-current/10 border border-current/30`}>
                          {TYPE_LABEL[c.type]}
                        </span>
                        <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0 mt-0.5`} />
                        <p className="text-sm text-white leading-relaxed">{c.text}</p>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>

        <Card className="mt-10">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-cyan flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white">
              <p className="font-semibold mb-1">Mau tahu rilis selanjutnya?</p>
              <p className="text-muted">
                Subscribe newsletter di <a href="/contact" className="text-cyan hover:underline">/contact</a> — kami kirim summary tiap rilis tanpa spam.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
