import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import LineAreaChart from "@/components/ui/charts/LineAreaChart";
import RadarChart from "@/components/ui/charts/RadarChart";
import {
  Brain, MessageSquare, Wand2, Workflow, Eye, ShieldCheck,
  FileDown, Layers, Database, Zap, GitBranch, Globe,
  Bell, Code2, Users, ArrowRight,
} from "lucide-react";

const features = [
  { icon: Brain, title: "AI Auto Chart Selection", desc: "Algoritma kami menganalisis tipe, distribusi, dan kardinalitas data untuk memilih chart paling tepat — line, bar, radar, scatter, atau heatmap." },
  { icon: MessageSquare, title: "Natural Language Query", desc: "Tanya: \"berapa pertumbuhan minggu ini?\" — dapatkan jawaban + chart pendukung secara instan." },
  { icon: Wand2, title: "AI Insight Generator", desc: "Auto-write summary, trend, korelasi, dan rekomendasi aksi dalam Bahasa Indonesia atau English." },
  { icon: Eye, title: "Anomaly & Outlier Detection", desc: "Z-score, IQR, isolation forest. Grafio menandai data aneh otomatis dan menjelaskan kenapa." },
  { icon: Workflow, title: "Auto Data Pipeline", desc: "Type inference, missing-value handling, joining multi-file, deduplikasi — semua otomatis." },
  { icon: Layers, title: "Dashboard Builder", desc: "Drag-drop chart untuk bikin dashboard custom. Bisa di-share via link, embed, atau iframe." },
  { icon: FileDown, title: "Export Multi-Format", desc: "PDF report, PPTX slide, PNG/SVG chart, cleaned CSV — semua dalam 1 klik." },
  { icon: Database, title: "Format Lengkap", desc: "CSV, TSV, Excel, JSON, Parquet, Feather, Arrow, HDF5, Pickle, ORC, Avro, SQLite, DuckDB." },
  { icon: GitBranch, title: "Version Control", desc: "Setiap dashboard punya history. Rollback ke versi sebelumnya kapan saja." },
  { icon: Bell, title: "Smart Alert", desc: "Set threshold, dapat notifikasi email/Slack saat metrik melewati batas." },
  { icon: Code2, title: "Python & SQL Mode", desc: "Untuk data scientist: editor inline dengan auto-complete & AI suggestion." },
  { icon: Users, title: "Real-time Collaboration", desc: "Comment, mention, dan co-edit dengan tim — seperti Figma untuk data." },
  { icon: ShieldCheck, title: "Privacy & Security", desc: "AES-256 encryption, SOC2 ready, GDPR compliant. Data tidak disimpan setelah analisis." },
  { icon: Globe, title: "Multi-language", desc: "Insight dalam Bahasa Indonesia, English, dan 10+ bahasa lain." },
  { icon: Zap, title: "Lightning Fast", desc: "Engine berbasis WebAssembly + DuckDB. 10× lebih cepat dari tool tradisional." },
];

export default function Features() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-20 pb-16">
        <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <p className="inline-block text-xs font-medium uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-6">
            Features
          </p>
          <h1 className="text-4xl md:text-6xl font-syne font-extrabold text-white leading-[1.05]">
            Semua yang kamu butuhkan, <br />
            <span className="text-gradient">dalam satu workspace.</span>
          </h1>
          <p className="text-muted max-w-2xl mx-auto mt-6 text-lg leading-relaxed">
            Dari upload mentah sampai presentasi siap-share. Grafio menggabungkan AI, design,
            dan engineering untuk pengalaman analitik paling efisien.
          </p>
        </div>
      </section>

      {/* Highlight 2-col */}
      <section className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-6 items-stretch">
        <Card glass className="!p-8">
          <p className="text-xs uppercase tracking-widest text-cyan mb-2">Time-Series AI</p>
          <h3 className="text-2xl font-syne font-bold text-white mb-3">Forecasting Otomatis</h3>
          <p className="text-muted mb-5 text-sm leading-relaxed">
            Grafio menggunakan model ARIMA + Prophet hybrid untuk prediksi 4-12 minggu ke depan,
            dengan confidence interval visual.
          </p>
          <LineAreaChart
            height={220}
            labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]}
            series={[
              { label: "Aktual", data: [22, 28, 34, 30, 41, 38, 52, 60], color: "#00D4FF" },
              { label: "Forecast", data: [60, 64, 70, 75, 78, 82, 85, 90], color: "#7B5EA7" },
            ]}
          />
        </Card>
        <Card glass className="!p-8">
          <p className="text-xs uppercase tracking-widest text-cyan mb-2">Multi-metric Comparison</p>
          <h3 className="text-2xl font-syne font-bold text-white mb-3">Benchmark Visual</h3>
          <p className="text-muted mb-5 text-sm leading-relaxed">
            Bandingkan brand, produk, atau region dalam satu radar interaktif. Hover untuk detail.
          </p>
          <RadarChart
            height={240}
            labels={["Speed", "Quality", "Price", "Support", "UX", "Coverage"]}
            series={[
              { label: "Grafio", data: [9, 9, 8, 9, 10, 9] },
              { label: "Tableau", data: [6, 8, 5, 7, 6, 7] },
              { label: "PowerBI", data: [7, 7, 7, 6, 7, 7] },
            ]}
          />
        </Card>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <SectionHeader
          eyebrow="Lengkap"
          title="15+ Fitur untuk Workflow Modern"
          description="Dirancang untuk data analyst, scientist, marketer, dan founder."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass rounded-xl p-6 hover:border-cyan/40 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center mb-4 group-hover:bg-cyan transition-colors">
                <f.icon className="w-5 h-5 text-cyan group-hover:text-bgDeep" />
              </div>
              <h3 className="font-syne font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-syne font-bold text-white mb-4">
          Coba semua fitur, gratis 7 hari.
        </h2>
        <p className="text-muted mb-8">Tanpa kartu kredit. Tanpa ribet.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup">
            <Button size="lg">
              Buat Akun <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" size="lg">
              Coba Demo
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
