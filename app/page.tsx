import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Logo from "@/components/ui/Logo";
import SectionHeader from "@/components/ui/SectionHeader";
import LineAreaChart from "@/components/ui/charts/LineAreaChart";
import BarChart from "@/components/ui/charts/BarChart";
import DoughnutChart from "@/components/ui/charts/DoughnutChart";
import RadarChart from "@/components/ui/charts/RadarChart";
import KpiCard from "@/components/ui/charts/KpiCard";
import {
  Sparkles, Zap, Brain, FileSpreadsheet, FileJson, Database,
  ShieldCheck, BarChart3, MessageSquare, Wand2, Workflow,
  Globe, FileDown, Layers, Eye, ArrowRight, Star, Check,
} from "lucide-react";

type FeatureAccent = "cyan" | "violet" | "mint" | "coral" | "warning" | "purple";
const features: { icon: any; title: string; desc: string; accent: FeatureAccent }[] = [
  { icon: Brain, title: "AI Auto Chart", desc: "Algoritma kami pilihkan visualisasi paling tepat berdasarkan tipe & distribusi data.", accent: "cyan" },
  { icon: MessageSquare, title: "Natural Language Query", desc: "Tanya ke datamu pakai bahasa biasa: \"penjualan tertinggi minggu ini?\"", accent: "violet" },
  { icon: Wand2, title: "Insight Generator", desc: "AI menulis ringkasan, trend, dan rekomendasi aksi otomatis dalam Bahasa Indonesia.", accent: "mint" },
  { icon: Workflow, title: "Auto Pipeline", desc: "Cleaning, type-inference, dan join multi-file otomatis tanpa nulis kode.", accent: "warning" },
  { icon: Eye, title: "Anomaly Detection", desc: "Deteksi outlier, drift, dan pola tidak biasa dengan z-score & IQR analysis.", accent: "coral" },
  { icon: FileDown, title: "PDF & PPT Export", desc: "Hasilkan laporan profesional siap presentasi dalam 1 klik.", accent: "cyan" },
  { icon: Layers, title: "Dashboard Builder", desc: "Drag-drop chart untuk bikin dashboard interaktif yang bisa di-share.", accent: "purple" },
  { icon: ShieldCheck, title: "Privacy First", desc: "Enkripsi end-to-end, data tidak disimpan setelah analisis selesai.", accent: "mint" },
];

const ACCENT_STYLES: Record<FeatureAccent, { bg: string; ring: string; icon: string; glow: string }> = {
  cyan:    { bg: "bg-cyan/12",    ring: "border-cyan/30",    icon: "text-cyan",       glow: "group-hover:shadow-glow" },
  violet:  { bg: "bg-violet/15",  ring: "border-violet/30",  icon: "text-violetSoft", glow: "group-hover:shadow-glow-violet" },
  mint:    { bg: "bg-mint/12",    ring: "border-mint/30",    icon: "text-mint",       glow: "group-hover:shadow-[0_8px_40px_-8px_rgba(0,255,179,0.4)]" },
  coral:   { bg: "bg-coral/15",   ring: "border-coral/30",   icon: "text-coral",      glow: "group-hover:shadow-[0_8px_40px_-8px_rgba(255,111,181,0.4)]" },
  warning: { bg: "bg-warning/12", ring: "border-warning/30", icon: "text-warning",    glow: "group-hover:shadow-[0_8px_40px_-8px_rgba(255,181,71,0.4)]" },
  purple:  { bg: "bg-purple/15",  ring: "border-purple/30",  icon: "text-purple",     glow: "group-hover:shadow-glow-purple" },
};

const integrations = [
  "CSV", "Excel", "JSON", "Parquet", "Feather", "Arrow", "Pickle",
  "HDF5", "ORC", "Avro", "SQLite", "DuckDB", "PostgreSQL",
  "BigQuery", "Snowflake", "MongoDB", "S3", "Notebook",
];

const testimonials = [
  { name: "Aria Putri", role: "Data Analyst, Tokopedia", quote: "Yang biasanya butuh 2 jam, sekarang 5 menit. Kesimpulan AI-nya jujur — dia kasih tahu kalau ada anomali yang aku lewat dan tetap minta konfirmasi konteks.", rating: 5 },
  { name: "Reza Hakim", role: "Data Scientist, Gojek", quote: "Wizard cleaning-nya beda. Per-anomali aku bisa pilih, jadi data yang sebenarnya emas (lonjakan kampanye) nggak ikut kebersih.", rating: 5 },
  { name: "Sintia Rahma", role: "Marketing Manager, UMKM", quote: "Saya bukan orang teknik tapi laporannya jadi keren banget. Penjelasannya pakai analogi sehari-hari — saya paham, klien juga paham.", rating: 5 },
  { name: "Bayu Pratama", role: "Mahasiswa S2 Statistika", quote: "Kesimpulan AI-nya beneran punya sudut pandang, bukan ringkasan generik. Bantu banget buat narasi skripsi.", rating: 5 },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />

      {/* HERO */}
      <section className="relative pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="reveal">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan"></span>
              </span>
              AI-Powered Visualization · v2.0 Live
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold font-syne leading-[1.05] tracking-tight">
              See Beyond <br />
              <span className="text-gradient">The Numbers.</span>
            </h1>
            <p className="text-lg text-muted max-w-xl mt-6 leading-relaxed">
              Upload data apa saja — CSV, Parquet, JSON, Excel, Notebook. Grafio AI memilih chart
              terbaik, menulis insight, dan menyusun dashboard interaktif dalam hitungan detik.
            </p>
            <div className="mt-9 flex items-center gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button size="lg" className="group">
                  Coba Sekarang Gratis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="ghost" size="lg">
                  Lihat Fitur
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-mint" /> Tanpa kartu kredit
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-mint" /> Gratis selamanya
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-mint" /> Setup 30 detik
              </div>
            </div>
          </div>

          {/* Hero card mock — premium dashboard preview */}
          <div className="relative reveal" style={{ animationDelay: "0.15s" }}>
            <div className="absolute -inset-8 bg-cyan/15 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -inset-8 bg-violet/15 blur-3xl rounded-full pointer-events-none translate-x-12 translate-y-12" />
            <div className="relative border-gradient rounded-2xl p-5 shadow-elev-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-mint/80" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted font-mono">grafio.app/dashboard</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <KpiCard label="Revenue" value="Rp 324M" change={12.4} spark={[20, 30, 28, 41, 38, 52, 60]} color="#00D4FF" />
                <KpiCard label="Users" value="48.2K" change={8.1} spark={[10, 12, 18, 22, 28, 34, 41]} color="#00FFB3" />
                <KpiCard label="ROAS" value="3.4×" change={-2.3} spark={[40, 38, 41, 35, 32, 30, 28]} color="#FF6FB5" />
              </div>
              <div className="bg-bgSurface/60 border border-borderColor rounded-lg p-3">
                <LineAreaChart
                  height={200}
                  labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]}
                  series={[
                    { label: "Forecast", data: [22, 28, 34, 30, 41, 38, 52, 60], color: "#00D4FF" },
                    { label: "Aktual", data: [20, 30, 28, 32, 38, 42, 49, 58], color: "#7B5EA7" },
                  ]}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Sparkles className="w-3.5 h-3.5 text-cyan" />
                <span>AI: Trend bullish, prediksi minggu 9: <span className="text-mint">+18%</span></span>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden md:block animate-float">
              <Logo className="w-20 h-20 text-silver" />
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE — Trusted */}
      <section className="border-y border-borderColor bg-bgSurface/40 py-6 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted mb-4">
          Format & sumber data yang didukung
        </p>
        <div className="marquee gap-12">
          {[...integrations, ...integrations].map((it, i) => (
            <span key={i} className="text-muted hover:text-white transition-colors text-sm font-medium whitespace-nowrap font-syne">
              {it}
            </span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Cara Kerja"
          title="3 Langkah dari Data ke Insight"
          description="Tanpa setup, tanpa coding. Cukup upload, biarkan AI bekerja, dan dapatkan dashboard siap presentasi."
        />
        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connecting line in desktop */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent pointer-events-none" />
          {[
            { num: "01", icon: FileSpreadsheet, title: "Upload Data", desc: "Drop CSV, Excel, Parquet, JSON, atau koneksi langsung ke database." },
            { num: "02", icon: Brain, title: "AI Analisis", desc: "Auto-clean, detect type, pilih chart terbaik, generate insight & rekomendasi." },
            { num: "03", icon: BarChart3, title: "Hasil Instan", desc: "Dashboard interaktif, PDF report, dan PPT slide siap di-share." },
          ].map((s, i) => (
            <div key={s.num} className="relative group">
              {/* Step number circle (replaces watermark) */}
              <div className="relative mx-auto w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-cyan/10 rounded-full blur-2xl group-hover:bg-cyan/20 transition-colors" />
                <div className="relative w-24 h-24 rounded-full border-2 border-cyan/30 bg-bgSurface flex items-center justify-center shadow-soft">
                  <span className="font-syne font-extrabold text-2xl text-gradient-cyan">{s.num}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-xl bg-cyan/15 border border-cyan/40 flex items-center justify-center backdrop-blur-sm">
                  <s.icon className="w-4 h-4 text-cyan" />
                </div>
              </div>
              <div className="text-center px-2">
                <h3 className="font-syne font-bold text-white text-lg mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CHART SHOWCASE */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Chart Library"
          title="Visualisasi Cerdas, Beragam, & Interactive"
          description="12+ jenis chart dengan tema gelap premium. AI memilih kombinasi terbaik untuk dataset kamu."
        />
        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
          <Card hover>
            <p className="text-xs uppercase tracking-widest text-cyan mb-2">Time Series</p>
            <h4 className="font-syne font-semibold text-white mb-4">Revenue Trend</h4>
            <LineAreaChart
              height={220}
              labels={["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"]}
              series={[
                { label: "2024", data: [30, 45, 35, 60, 55, 75], color: "#00D4FF" },
                { label: "2023", data: [22, 32, 30, 42, 40, 55], color: "#7B5EA7" },
              ]}
            />
          </Card>
          <Card hover>
            <p className="text-xs uppercase tracking-widest text-cyan mb-2">Comparison</p>
            <h4 className="font-syne font-semibold text-white mb-4">Channel Performance</h4>
            <BarChart
              height={220}
              labels={["Direct", "SEO", "Ads", "Email", "Social"]}
              series={[
                { label: "Q1", data: [120, 95, 140, 60, 85], color: "#00D4FF" },
                { label: "Q2", data: [150, 110, 160, 75, 95], color: "#00FFB3" },
              ]}
            />
          </Card>
          <Card hover>
            <p className="text-xs uppercase tracking-widest text-cyan mb-2">Distribution</p>
            <h4 className="font-syne font-semibold text-white mb-4">Market Share</h4>
            <DoughnutChart
              height={220}
              labels={["Mobile", "Desktop", "Tablet", "Other"]}
              data={[58, 32, 8, 2]}
              centerLabel="100%"
            />
          </Card>
          <Card hover>
            <p className="text-xs uppercase tracking-widest text-cyan mb-2">Multi-metric</p>
            <h4 className="font-syne font-semibold text-white mb-4">Brand Performance Radar</h4>
            <RadarChart
              height={240}
              labels={["Awareness", "Engagement", "Retention", "Loyalty", "Recommend", "Trust"]}
              series={[
                { label: "Q1 2026", data: [7, 8, 6, 7, 8, 8], color: "#00D4FF" },
                { label: "Q2 2026", data: [9, 9, 8, 8, 9, 9], color: "#7B5EA7" },
              ]}
            />
          </Card>
          <Card hover className="lg:col-span-2">
            <p className="text-xs uppercase tracking-widest text-cyan mb-2">Stacked</p>
            <h4 className="font-syne font-semibold text-white mb-4">Revenue by Segment</h4>
            <BarChart
              stacked
              height={240}
              labels={["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"]}
              series={[
                { label: "Enterprise", data: [40, 50, 45, 60, 55, 70], color: "#00D4FF" },
                { label: "SMB", data: [20, 30, 25, 35, 40, 45], color: "#7B5EA7" },
                { label: "Startup", data: [10, 15, 20, 25, 22, 30], color: "#00FFB3" },
              ]}
            />
          </Card>
        </div>
      </section>

      {/* FEATURES GRID — colored icon cards ala modern AI products */}
      <section className="max-w-7xl mx-auto px-6 py-24 relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[480px] bg-grad-mesh opacity-50 pointer-events-none" />
        <div className="relative">
          <SectionHeader
            eyebrow="Fitur Unggulan"
            title="Lebih Cerdas, Lebih Cepat, Lebih Indah"
            description="Built untuk data analyst, scientist, marketer, dan founder. Setiap detail dirancang agar kamu bisa fokus pada cerita di balik angka."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const a = ACCENT_STYLES[f.accent];
              return (
                <div
                  key={i}
                  className={`group glass rounded-2xl p-5 hover-lift transition-all duration-300 ${a.glow}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${a.bg} border ${a.ring} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110`}>
                    <f.icon className={`w-5 h-5 ${a.icon}`} />
                  </div>
                  <h3 className="font-syne font-semibold text-white mb-1.5 text-base">{f.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== GRAFIO DIFFERENCE — WHY US ===== */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Yang Bikin Beda"
          title="Pengalaman Analisis yang Sebenarnya"
          description="Tools statistik biasanya kasih kamu angka. Grafio kasih kamu cerita di balik angka — dengan AI yang ngerti konteks bisnis kamu."
        />
        <div className="grid md:grid-cols-2 gap-5">
          {[
            {
              icon: Brain,
              title: "AI Yang Minta Konfirmasi",
              desc: "Sebelum analisis, Grafio kasih lihat pemahamannya soal datamu. Kamu koreksi kalau salah. AI ingat konteksmu untuk SEMUA analisis & chat berikutnya.",
            },
            {
              icon: Wand2,
              title: "Cleaning Per-Anomali",
              desc: "Bukan tombol \"auto-clean\" yang membabi buta. Setiap anomali yang AI temukan, kamu yang putuskan: perbaiki atau pertahankan. Health Score real-time menunjukkan progress.",
            },
            {
              icon: MessageSquare,
              title: "Bahasa Manusia, Bukan Jargon",
              desc: "Korelasi r=0.85 dijelaskan sebagai \"seperti tinggi & berat badan — satu naik, yang lain pasti ikut.\" Orang non-statistik tetap paham.",
            },
            {
              icon: Sparkles,
              title: "Kesimpulan Bersudut Pandang",
              desc: "Bukan ringkasan statistik kering. Grafio kasih opini berdasarkan data: \"momentum panas\", \"sinyal melemah\", \"anomali kemungkinan kampanye\".",
            },
          ].map((it, i) => (
            <div key={i} className="glass rounded-2xl p-6 hover:border-cyan/40 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                  <it.icon className="w-5 h-5 text-cyan" />
                </div>
                <div className="flex-1">
                  <h3 className="font-syne font-bold text-white text-lg mb-2">{it.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{it.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/features">
            <Button variant="ghost" size="lg">
              Lihat semua cara Grafio bekerja <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Testimoni"
          title="Apa Kata Mereka"
          description="Ribuan analyst, scientist, dan founder sudah membuktikan."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="group glass rounded-2xl p-6 hover-lift hover:border-cyan/30 transition-all duration-300 shadow-soft flex flex-col"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-cyan text-cyan" />
                ))}
              </div>
              <p className="text-sm text-white/90 mb-5 leading-relaxed flex-1 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-borderColor">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan via-cyanSoft to-violet flex items-center justify-center text-bgDeep font-bold text-sm shadow-soft">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[10px] text-muted">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="relative overflow-hidden border-gradient rounded-3xl p-10 md:p-16 text-center shadow-elev-lg">
          <div className="absolute inset-0 bg-grad-mesh opacity-70 pointer-events-none" />
          <div className="glow-orb top-0 right-0 w-72 h-72 bg-cyan/30" />
          <div className="glow-orb bottom-0 left-0 w-72 h-72 bg-violet/30" />
          <div className="relative">
            <Logo className="w-20 h-20 mx-auto mb-6 animate-float" />
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1 rounded-full mb-5">
              Gratis · Tanpa kartu kredit
            </span>
            <h2 className="text-3xl md:text-5xl font-syne font-extrabold text-white mb-4 leading-tight">
              Siap melihat <br className="md:hidden" />
              <span className="text-gradient-violet">cerita di balik angka?</span>
            </h2>
            <p className="text-muted max-w-xl mx-auto mb-8 text-base leading-relaxed">
              Upload file pertamamu, dapatkan dashboard AI dengan insight lengkap dalam 30 detik.
              Tidak perlu install, tidak perlu coding.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button size="lg" className="group">
                  Coba Gratis Sekarang
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="ghost" size="lg">
                  Lihat Semua Fitur
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
