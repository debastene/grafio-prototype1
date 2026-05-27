import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Target, Heart, Zap, Globe, Users, TrendingUp } from "lucide-react";

export const metadata = {
  title: "About — Grafio",
  description: "Cerita di balik Grafio: kenapa kami bangun ini.",
};

const values = [
  {
    icon: Heart,
    title: "Privacy First",
    body: "Datamu, milikmu. Kami tidak training model dengan data pengguna. Engine jalan di browser, bukan di server kami.",
  },
  {
    icon: Zap,
    title: "Speed Wins",
    body: "Insight dalam detik, bukan jam. Engine lokal untuk angka eksak + AI untuk narasi natural — hybrid tercepat.",
  },
  {
    icon: Globe,
    title: "Indonesian-First",
    body: "Bahasa Indonesia natural di setiap insight. Format angka ID/EN auto-detect. Domain tropis (ekonomi syariah, BPJS, dll).",
  },
  {
    icon: Users,
    title: "For Everyone",
    body: "Bukan cuma data scientist. Mahasiswa, founder UMKM, jurnalis — siapa pun bisa pakai dalam 1 menit pertama.",
  },
];

const milestones = [
  { date: "Jul 2025", event: "Side project dimulai — frustasi dengan dashboard tradisional yang lambat." },
  { date: "Oct 2025", event: "Engine statistik client-side v0.5 live. 30 beta tester." },
  { date: "Jan 2026", event: "Public launch v1.0 dengan dukungan Bahasa Indonesia natural." },
  { date: "Mar 2026", event: "1,000 pengguna aktif. Integrasi OpenRouter free-tier untuk demokratisasi AI." },
  { date: "May 2026", event: "v2.0 — AI Copilot full, narasi PDF report, conversational filter (in progress)." },
];

export default function About() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 bg-grad-hero opacity-50 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="reveal">
        <SectionHeader
          eyebrow="About"
          title="Lihat di balik angka"
          description="Grafio dibangun oleh tim kecil yang percaya bahwa data analisis seharusnya semudah mengetik pertanyaan, bukan menulis SQL atau memencet 20 menu."
        />
        </div>

        <Card className="mb-10 bg-gradient-to-br from-cyan/5 to-purple/5 border-cyan/20 reveal" hover>
          <div className="flex items-start gap-4">
            <Target className="w-8 h-8 text-cyan flex-shrink-0" />
            <div>
              <h2 className="font-syne font-bold text-white text-xl mb-2">Misi Kami</h2>
              <p className="text-white leading-relaxed">
                Demokratisasi data analytics untuk 270 juta orang Indonesia. Membuat insight dari data
                mengalir natural seperti percakapan — tidak peduli kamu CFO perusahaan publik atau
                mahasiswa S1 yang lagi skripsi.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {values.map((v, i) => {
            const Icon = v.icon;
            return (
              <Card key={v.title} hover className="reveal" >
                <Icon className="w-6 h-6 text-cyan mb-3" />
                <h3 className="font-syne font-bold text-white mb-1.5">{v.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{v.body}</p>
              </Card>
            );
          })}
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-cyan" />
            <h2 className="font-syne font-bold text-white text-2xl">Perjalanan</h2>
          </div>
          <div className="space-y-3">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="w-24 flex-shrink-0 pt-1">
                  <span className="text-xs font-mono text-cyan uppercase tracking-widest">{m.date}</span>
                </div>
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-cyan mt-2 group-hover:scale-150 transition-transform" />
                <p className="text-sm text-white leading-relaxed pt-0.5">{m.event}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="text-center reveal" hover>
          <p className="text-muted mb-4">Ingin tahu lebih lanjut atau collab?</p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft hover:shadow-glow-lg transition-all duration-300 ease-glide text-sm font-syne shadow-glow"
          >
            Kontak Tim
          </a>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
