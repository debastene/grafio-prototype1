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

const features = [
  { icon: Brain, title: "AI Auto Chart", desc: "Algoritma kami pilihkan visualisasi paling tepat berdasarkan tipe & distribusi data." },
  { icon: MessageSquare, title: "Natural Language Query", desc: "Tanya ke datamu pakai bahasa biasa: \"penjualan tertinggi minggu ini?\"" },
  { icon: Wand2, title: "Insight Generator", desc: "AI menulis ringkasan, trend, dan rekomendasi aksi otomatis dalam Bahasa Indonesia." },
  { icon: Workflow, title: "Auto Pipeline", desc: "Cleaning, type-inference, dan join multi-file otomatis tanpa nulis kode." },
  { icon: Eye, title: "Anomaly Detection", desc: "Deteksi outlier, drift, dan pola tidak biasa dengan z-score & IQR analysis." },
  { icon: FileDown, title: "PDF & PPT Export", desc: "Hasilkan laporan profesional siap presentasi dalam 1 klik." },
  { icon: Layers, title: "Dashboard Builder", desc: "Drag-drop chart untuk bikin dashboard interaktif yang bisa di-share." },
  { icon: ShieldCheck, title: "Privacy First", desc: "Enkripsi end-to-end, data tidak disimpan setelah analisis selesai." },
];

const integrations = [
  "CSV", "Excel", "JSON", "Parquet", "Feather", "Arrow", "Pickle",
  "HDF5", "ORC", "Avro", "SQLite", "DuckDB", "PostgreSQL",
  "BigQuery", "Snowflake", "MongoDB", "S3", "Notebook",
];

const testimonials = [
  { name: "Aria Putri", role: "Data Analyst, Tokopedia", quote: "Yang biasanya butuh 2 jam di Excel + Tableau, sekarang 5 menit di Grafio. Insight AI-nya jujur — dia kasih tahu kalau ada anomali yang aku lewat.", rating: 5 },
  { name: "Reza Hakim", role: "Data Scientist, Gojek", quote: "Akhirnya tool yang ngerti bedanya analyst vs scientist. Saya bisa upload Parquet langsung, ada heatmap korelasi & deteksi outlier.", rating: 5 },
  { name: "Sintia Rahma", role: "Marketing Manager, UMKM", quote: "Saya bukan orang teknik tapi laporan saya jadi keren banget. Klien selalu kagum dengan visualisasinya.", rating: 5 },
  { name: "Bayu Pratama", role: "Mahasiswa S2 Statistika", quote: "Skripsi saya selamat. Chart radar & korelasinya tinggal copy ke Word.", rating: 5 },
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
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              AI-Powered Visualization v2.0
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
                <Button size="lg">
                  Mulai Gratis <ArrowRight className="w-4 h-4" />
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

          {/* Hero card mock */}
          <div className="relative reveal" style={{ animationDelay: "0.15s" }}>
            <div className="absolute -inset-4 bg-cyan/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative glass rounded-2xl p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-danger" />
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <div className="w-2 h-2 rounded-full bg-mint" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted">grafio.app/dashboard</span>
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
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { num: "01", icon: FileSpreadsheet, title: "Upload Data", desc: "Drop CSV, Excel, Parquet, JSON, atau koneksi langsung ke database." },
            { num: "02", icon: Brain, title: "AI Analisis", desc: "Auto-clean, detect type, pilih chart terbaik, generate insight & rekomendasi." },
            { num: "03", icon: BarChart3, title: "Hasil Instan", desc: "Dashboard interaktif, PDF report, dan PPT slide siap di-share." },
          ].map((s) => (
            <Card key={s.num} hover className="relative overflow-hidden">
              <span className="absolute -top-2 -right-2 text-7xl font-syne font-extrabold text-cyan/5 select-none">
                {s.num}
              </span>
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-cyan" />
                </div>
                <h3 className="font-syne font-bold text-white text-lg mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            </Card>
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
            <h4 className="font-syne font-semibold text-white mb-4">Performance Radar</h4>
            <RadarChart
              height={240}
              labels={["Speed", "Reliability", "UX", "Cost", "Coverage", "Support"]}
              series={[
                { label: "Grafio", data: [9, 9, 10, 8, 9, 9], color: "#00D4FF" },
                { label: "Industry Avg", data: [6, 7, 6, 7, 6, 5], color: "#7B5EA7" },
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

      {/* FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Fitur Unggulan"
          title="Lebih Cerdas, Lebih Cepat, Lebih Indah"
          description="Built untuk data analyst, scientist, marketer, dan founder. Setiap detail dirancang agar kamu bisa fokus pada cerita di balik angka."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass rounded-xl p-5 group hover:border-cyan/40 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center mb-4 group-hover:bg-cyan group-hover:text-bgDeep transition-all">
                <f.icon className="w-5 h-5 text-cyan group-hover:text-bgDeep" />
              </div>
              <h3 className="font-syne font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SectionHeader
          eyebrow="Perbandingan"
          title="Kenapa Pilih Grafio?"
          description="Dibanding tool tradisional, Grafio unggul di kecepatan, kecerdasan AI, dan estetika."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-3 pr-6 font-medium">Kapabilitas</th>
                <th className="py-3 px-4 font-medium text-center">
                  <span className="font-syne font-bold text-white">Grafio</span>
                </th>
                <th className="py-3 px-4 font-medium text-center">Excel</th>
                <th className="py-3 px-4 font-medium text-center">Tableau</th>
                <th className="py-3 px-4 font-medium text-center">PowerBI</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Auto chart selection (AI)", true, false, false, "Limited"],
                ["Natural language query", true, false, "Premium", true],
                ["Auto insight generation", true, false, false, "Limited"],
                ["Support Parquet/Feather/HDF5", true, false, false, "Plugin"],
                ["1-click PDF & PPT report", true, false, "Premium", "Premium"],
                ["Anomaly detection", true, false, "Premium", "Premium"],
                ["Setup time", "30 detik", "—", "Hari", "Jam"],
                ["Learning curve", "Mudah", "Mudah", "Curam", "Sedang"],
              ].map((row, i) => (
                <tr key={i} className="border-t border-borderColor">
                  <td className="py-3 pr-6 text-white">{row[0]}</td>
                  {row.slice(1).map((c, j) => (
                    <td key={j} className="py-3 px-4 text-center">
                      {c === true ? (
                        <Check className="w-4 h-4 text-mint mx-auto" />
                      ) : c === false ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="text-muted text-xs">{c}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            <Card key={i} hover>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-cyan text-cyan" />
                ))}
              </div>
              <p className="text-sm text-white mb-4 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-3 border-t border-borderColor">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan to-purple flex items-center justify-center text-bgDeep font-bold text-xs">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-[10px] text-muted">{t.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="relative overflow-hidden glass rounded-3xl p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-grad-hero opacity-60 pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan/20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <Logo className="w-16 h-16 text-silver mx-auto mb-6 animate-float" />
            <h2 className="text-3xl md:text-5xl font-syne font-extrabold text-white mb-4">
              Siap melihat <span className="text-gradient">cerita di balik angka?</span>
            </h2>
            <p className="text-muted max-w-xl mx-auto mb-8">
              Mulai gratis. Upload file pertamamu, dapatkan dashboard AI dalam 30 detik.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard">
                <Button size="lg">
                  Coba Gratis <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" size="lg">
                  Lihat Harga
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
