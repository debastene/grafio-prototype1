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
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Changelog"
          title="Apa yang baru di Grafio"
          description="Update fitur, perbaikan, dan optimasi — biasanya rilis tiap 2-4 minggu."
        />

        <div className="space-y-8">
          {releases.map((r) => (
            <div key={r.version}>
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
