"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import Reveal from "@/components/ui/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/ui/motion/Stagger";
import MagneticButton from "@/components/ui/motion/MagneticButton";
import CountUp from "@/components/ui/motion/CountUp";
import TiltCard from "@/components/ui/motion/TiltCard";
import MarqueeRow from "@/components/ui/motion/MarqueeRow";
import ExpandableFeatures from "@/components/ui/landing/ExpandableFeatures";
import {
  Sparkles, Brain, FileSpreadsheet,
  ShieldCheck, BarChart3, MessageSquare, Wand2, Workflow,
  FileDown, Layers, Eye, ArrowRight, Star, Check,
} from "lucide-react";

// OrbitStar = bespoke interactive centerpiece (drag-to-rotate + momentum +
// pill insight orbital). Lazy-load client-only supaya SSR landing ringan.
// Loading placeholder ukuran SAMA dengan actual orbit supaya tidak layout-jump
// saat hydration: 240 mobile / 340 desktop (lihat usage di hero).
const OrbitStar = dynamic(() => import("@/components/ui/motion/OrbitStar"), {
  ssr: false,
  loading: () => <div className="w-[240px] h-[240px] md:w-[340px] md:h-[340px]" />,
});

type FeatureAccent = "cyan" | "violet" | "mint" | "coral" | "warning" | "purple";
const features: { icon: any; title: string; desc: string; accent: FeatureAccent }[] = [
  { icon: Brain, title: "AI Auto Chart", desc: "Algoritma kami memilih visualisasi paling tepat berdasarkan tipe & distribusi datamu — line untuk time-series, doughnut untuk distribusi, scatter untuk korelasi, semua otomatis.", accent: "cyan" },
  { icon: MessageSquare, title: "Natural Language Query", desc: "Tanya ke datamu pakai bahasa biasa: \"penjualan tertinggi minggu ini?\". AI memahami konteks, jawab dengan angka aktual dari datasetmu, bukan jawaban generik.", accent: "violet" },
  { icon: Wand2, title: "Insight Generator", desc: "AI menulis ringkasan, trend, dan rekomendasi aksi otomatis dalam Bahasa Indonesia — dengan sudut pandang, bukan jargon statistik kering.", accent: "mint" },
  { icon: Workflow, title: "Auto Pipeline", desc: "Cleaning per-anomali, type-inference, dan join multi-file otomatis tanpa nulis kode. Kamu yang putuskan apa yang dipertahankan, AI yang eksekusi.", accent: "warning" },
  { icon: Eye, title: "Anomaly Detection", desc: "Deteksi outlier, drift, dan pola tidak biasa dengan z-score & IQR analysis — lengkap dengan penjelasan dampaknya ke analisismu.", accent: "coral" },
  { icon: FileDown, title: "PDF & PPT Export", desc: "Hasilkan laporan profesional siap presentasi dalam 1 klik. Ditulis seperti analyst senior menjelaskan ke direksi, bukan dump tabel.", accent: "cyan" },
  { icon: Layers, title: "Dashboard Builder", desc: "Drag-drop chart untuk bikin dashboard interaktif yang bisa di-share. Susun KPI, grafik, dan narasi dalam satu kanvas.", accent: "purple" },
  { icon: ShieldCheck, title: "Privacy First", desc: "Parsing & cleaning jalan di browser kamu. Hanya statistik agregat yang dikirim ke AI untuk narasi — raw data tidak pernah meninggalkan device.", accent: "mint" },
];

const integrations = [
  "CSV", "Excel", "JSON", "Parquet", "Feather", "Arrow", "Pickle",
  "HDF5", "ORC", "Avro", "SQLite", "DuckDB", "PostgreSQL",
  "BigQuery", "Snowflake", "MongoDB", "S3", "Notebook",
];

const stats = [
  { value: 30, suffix: "s", label: "Dari upload ke dashboard", description: "Setup median user — tanpa coding, tanpa setup tools." },
  { value: 95, suffix: "%", label: "Insight relevan & dapat ditindaklanjuti", description: "Berdasarkan feedback rata-rata pengguna early access." },
  { value: 12, suffix: "+", label: "Jenis chart adaptive", description: "Auto-pilih kombinasi terbaik untuk dataset kamu." },
  { value: 100, suffix: "%", label: "Data tetap di browser", description: "Engine lokal — privacy by design, bukan janji marketing." },
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

      {/* ===== HERO — compact, semua fit di first viewport (above the fold) ===== */}
      <section className="relative pt-6 pb-10 md:pt-8 md:pb-14 overflow-hidden">
        {/* Atmospheric backdrop — radial fog converge ke center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(0,212,255,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 50% 65%, rgba(139,92,246,0.12) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute inset-0 grid-bg pointer-events-none opacity-30"
          style={{
            maskImage:
              "radial-gradient(ellipse 50% 40% at 50% 50%, #000 0%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 50% 40% at 50% 50%, #000 0%, transparent 75%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-6 flex flex-col items-center text-center">
          {/* EYEBROW */}
          <Reveal>
            <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-cyan border border-cyan/30 bg-cyan/5 px-4 py-1.5 rounded-full backdrop-blur-sm font-mono">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan"></span>
              </span>
              v2.0 · AI Analytics Workspace
            </span>
          </Reveal>

          {/* CENTERPIECE — interactive orbit star, drag untuk spin */}
          <Reveal delay={0.12} className="relative my-3 md:my-4">
            <div className="hidden md:flex items-center justify-center">
              <OrbitStar
                size={340}
                labels={[
                  "Revenue", "Users", "Growth",
                  "Trends", "Signals", "Anomaly",
                  "Forecast", "Retention", "Churn",
                ]}
                ringCount={3}
                baseSpeed={14}
              />
            </div>
            <div className="md:hidden flex items-center justify-center">
              <OrbitStar
                size={240}
                labels={["Revenue", "Users", "Trends", "Signals", "Forecast", "Churn"]}
                ringCount={2}
                baseSpeed={14}
              />
            </div>
          </Reveal>

          {/* HEADLINE — 2 baris max, tight */}
          <Reveal delay={0.22}>
            <h1 className="font-syne font-extrabold tracking-[-0.025em] leading-[1.02] text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem]">
              <span className="block whitespace-nowrap">See Beyond</span>
              <span className="block whitespace-nowrap text-gradient">The Numbers.</span>
            </h1>
          </Reveal>

          {/* SUBHEAD — pendek, 1-2 baris */}
          <Reveal delay={0.3}>
            <p className="mt-4 text-base md:text-lg text-muted max-w-xl leading-relaxed">
              AI analytics workspace untuk analyst, scientist &amp; founder Indonesia.
            </p>
          </Reveal>

          {/* CTA */}
          <Reveal delay={0.38}>
            <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
              <MagneticButton strength={0.22}>
                <Link href="/dashboard">
                  <Button size="lg" className="group">
                    Coba Sekarang Gratis
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </MagneticButton>
              <Link href="/features">
                <Button variant="ghost" size="lg">
                  Lihat Fitur
                </Button>
              </Link>
            </div>
          </Reveal>

          {/* TRUST ROW — above the fold */}
          <Reveal delay={0.46}>
            <div className="mt-5 flex items-center gap-6 text-xs text-muted flex-wrap justify-center">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-mint" /> Tanpa kartu kredit</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-mint" /> Gratis selamanya</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-mint" /> Setup 30 detik</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== PRODUCT PREVIEW — di bawah hero, section sendiri ===== */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20 md:pb-24">
        <Reveal delay={0.1}>
          <div className="relative">
            {/* Halo glows behind product */}
            <div className="absolute -inset-10 bg-cyan/15 blur-[100px] rounded-full opacity-60 pointer-events-none" />
            <div className="absolute -inset-8 -right-20 bg-violet/15 blur-[100px] rounded-full opacity-60 pointer-events-none" />

            <div className="relative border-gradient rounded-2xl shadow-elev-lg backdrop-blur-md bg-bgDeep/80 overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-borderColor bg-bgSurface/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-mint/80" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted/80 font-mono">
                  grafio.app / dashboard
                </span>
                <div className="w-12" />
              </div>

              <div className="p-6 md:p-7 grid lg:grid-cols-[2fr_1fr] gap-5">
                {/* Left column — KPIs + chart */}
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <KpiCard label="Revenue" value="Rp 324M" change={12.4} spark={[20, 30, 28, 41, 38, 52, 60]} color="#00D4FF" />
                    <KpiCard label="Users" value="48.2K" change={8.1} spark={[10, 12, 18, 22, 28, 34, 41]} color="#00FFB3" />
                    <KpiCard label="ROAS" value="3.4×" change={-2.3} spark={[40, 38, 41, 35, 32, 30, 28]} color="#FF6FB5" />
                  </div>

                  <div className="bg-bgSurface/60 border border-borderColor rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
                        Forecast vs Aktual · 8 minggu
                      </p>
                      <span className="text-[10px] text-mint flex items-center gap-1.5 font-mono uppercase tracking-widest">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-mint"></span>
                        </span>
                        Live
                      </span>
                    </div>
                    <LineAreaChart
                      height={220}
                      labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]}
                      series={[
                        { label: "Forecast", data: [22, 28, 34, 30, 41, 38, 52, 60], color: "#00D4FF" },
                        { label: "Aktual", data: [20, 30, 28, 32, 38, 42, 49, 58], color: "#A78BFA" },
                      ]}
                    />
                  </div>
                </div>

                {/* Right column — AI insight stack (ala Legora task list panel) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
                    <Sparkles className="w-3 h-3 text-cyan" />
                    AI sedang menulis insight
                  </div>

                  <div className="rounded-lg border border-violet/30 bg-violet/8 p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-violetSoft uppercase tracking-widest">
                      <span className="w-1 h-1 rounded-full bg-violetSoft" />
                      Kesimpulan
                    </div>
                    <p className="text-sm text-white leading-relaxed">
                      <span className="font-semibold">Momentum bullish.</span> Konsistensi 6 minggu, proyeksi W9 <span className="text-mint font-semibold">+18%</span> bila pola bertahan.
                    </p>
                  </div>

                  <div className="rounded-lg border border-borderColor bg-bgSurface/50 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan uppercase tracking-widest">
                      <span className="w-1 h-1 rounded-full bg-cyan" />
                      Anomali
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      W4 dip −12% kemungkinan kampanye Ramadhan (data emas, jangan dibersihkan).
                    </p>
                  </div>

                  <div className="rounded-lg border border-borderColor bg-bgSurface/50 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-mint uppercase tracking-widest">
                      <span className="w-1 h-1 rounded-full bg-mint" />
                      Rekomendasi
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Pertimbangkan A/B test kanal ROAS &lt; 2× — leak budget terdeteksi.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating "auto-generated" tag */}
            <div className="absolute -bottom-3 -right-3 hidden md:block">
              <div className="bg-bgElevated/90 backdrop-blur-md border border-cyan/40 rounded-full px-3 py-1.5 shadow-glow flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan" />
                <span className="text-[10px] font-mono text-cyan uppercase tracking-widest">
                  Auto-generated · 1.2s
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== TRUSTED BY (sector pills) ===== */}
      <section className="relative border-y border-borderColor bg-bgSurface/30 backdrop-blur-sm overflow-hidden">
        <Reveal>
          <div className="max-w-7xl mx-auto px-6 pt-9 pb-7 grid lg:grid-cols-[auto_1fr] gap-x-12 gap-y-6 items-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted font-mono whitespace-nowrap">
              Dipakai analyst & founder di
            </p>
            <div className="flex items-center gap-x-8 gap-y-3 flex-wrap">
              {["E-commerce", "Fintech", "Telco", "Banking", "Marketing", "Riset Akademik"].map((sector) => (
                <span
                  key={sector}
                  className="text-muted/85 hover:text-white transition-colors duration-300 text-sm font-syne font-bold tracking-wide"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* === FORMAT TICKER === ala Stockbit index ticker
             - thin bar, dense, monospace
             - "LIVE" indicator + label "FORMATS" di kiri
             - format names dengan ✓ badge ala harga +/- ticker
             - continuous scroll right-to-left, hover-pause
             - fade-out di kedua edge */}
        <div className="relative border-t border-borderColor bg-bgDeep/70 backdrop-blur-md overflow-hidden">
          {/* Edge fades */}
          <div className="absolute inset-y-0 left-0 w-20 md:w-28 bg-gradient-to-r from-bgDeep to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 md:w-28 bg-gradient-to-l from-bgDeep to-transparent z-10 pointer-events-none" />

          <div className="flex items-stretch">
            {/* LIVE label (sticky kiri, ala ticker stock) */}
            <div className="hidden sm:flex items-center gap-2 px-5 py-3 border-r border-borderColor bg-bgElevated/50 flex-shrink-0 z-20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-mint"></span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-mint font-bold">
                LIVE
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted/70 hidden md:inline">
                · FORMATS
              </span>
            </div>

            {/* Ticker scroll */}
            <div className="flex-1 overflow-hidden py-3">
              <MarqueeRow speed={45}>
                {[...integrations, ...integrations, ...integrations].map((it, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap font-mono group"
                  >
                    <span className="text-muted/40 mr-3">·</span>
                    <span className="text-white/85 group-hover:text-cyan transition-colors duration-300 font-medium tracking-wide">
                      {it}
                    </span>
                    <span className="text-[9px] font-bold text-mint/80 bg-mint/10 border border-mint/25 px-1 py-px rounded leading-none">
                      ✓
                    </span>
                  </span>
                ))}
              </MarqueeRow>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS — count-up ===== */}
      <section className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <Reveal>
          <div className="text-center mb-14">
            <p className="inline-block text-xs font-mono uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-4">
              By the numbers
            </p>
            <h2 className="text-3xl md:text-5xl font-syne font-bold text-white max-w-3xl mx-auto leading-tight">
              Cepat. <span className="text-gradient">Akurat.</span> <span className="text-muted/70">Aman.</span>
            </h2>
          </div>
        </Reveal>
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-borderColor rounded-2xl overflow-hidden">
          {stats.map((s, i) => (
            <StaggerItem
              key={i}
              className="bg-bgDeep p-8 md:p-10 text-center md:text-left"
            >
              <p className="text-5xl md:text-6xl font-syne font-extrabold text-gradient leading-none">
                <CountUp to={s.value} suffix={s.suffix} duration={1.4} />
              </p>
              <p className="text-white font-syne font-semibold text-base mt-4">{s.label}</p>
              <p className="text-muted text-xs mt-2 leading-relaxed">{s.description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== HOW IT WORKS — horizontal flow, ada output preview per step ===== */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <Reveal>
          <div className="max-w-2xl mb-16">
            <p className="inline-block text-[11px] font-mono uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-5">
              Cara Kerja
            </p>
            <h2 className="text-3xl md:text-5xl font-syne font-bold text-white leading-[1.1] mb-4">
              Dari file mentah ke <span className="text-gradient">dashboard yang ngomong</span> — dalam 30 detik.
            </h2>
            <p className="text-muted text-base md:text-lg leading-relaxed">
              Tiga langkah. Tanpa setup, tanpa coding. Kamu upload, AI analisis dengan minta konfirmasi konteks, lalu kasih kesimpulan bersudut pandang.
            </p>
          </div>
        </Reveal>

        <Stagger className="grid md:grid-cols-3 gap-px bg-borderColor rounded-2xl overflow-hidden" gap={0.1}>
          {[
            {
              num: "01",
              icon: FileSpreadsheet,
              title: "Upload",
              desc: "Drop CSV, Excel, Parquet, JSON, atau koneksi langsung ke database.",
              tag: "50MB max · 18+ format",
            },
            {
              num: "02",
              icon: Brain,
              title: "AI Baca Konteks",
              desc: "AI cek skema, kasih lihat pemahamannya, minta kamu konfirmasi sebelum analisis.",
              tag: "Per-anomali cleaning",
            },
            {
              num: "03",
              icon: BarChart3,
              title: "Insight & Export",
              desc: "Dashboard interaktif, narasi bersudut pandang, PDF/PPT siap presentasi.",
              tag: "12+ chart adaptive",
            },
          ].map((s) => (
            <StaggerItem
              key={s.num}
              className="relative bg-bgDeep p-8 md:p-10 group hover:bg-bgSurface/40 transition-colors duration-400 ease-glide"
            >
              <div className="flex items-start justify-between mb-8">
                <span className="text-xs font-mono text-cyan/70 tracking-widest">{s.num}</span>
                <div className="w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center group-hover:bg-cyan/20 group-hover:border-cyan/50 transition-all duration-400 ease-glide">
                  <s.icon className="w-4 h-4 text-cyan" />
                </div>
              </div>
              <h3 className="font-syne font-bold text-white text-xl md:text-2xl mb-2 leading-tight">{s.title}</h3>
              <p className="text-muted text-sm leading-relaxed mb-5">{s.desc}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-mono pt-4 border-t border-borderColor/60">
                {s.tag}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== CHART SHOWCASE ===== */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Chart Library"
            title="Visualisasi Cerdas, Beragam, & Interactive"
            description="12+ jenis chart dengan tema gelap premium. AI memilih kombinasi terbaik untuk dataset kamu."
          />
        </Reveal>
        <Stagger className="grid lg:grid-cols-3 md:grid-cols-2 gap-6" gap={0.07}>
          {[
            { label: "Time Series", title: "Revenue Trend", el: (
              <LineAreaChart
                height={220}
                labels={["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"]}
                series={[
                  { label: "2024", data: [30, 45, 35, 60, 55, 75], color: "#00D4FF" },
                  { label: "2023", data: [22, 32, 30, 42, 40, 55], color: "#7B5EA7" },
                ]}
              />
            ) },
            { label: "Comparison", title: "Channel Performance", el: (
              <BarChart
                height={220}
                labels={["Direct", "SEO", "Ads", "Email", "Social"]}
                series={[
                  { label: "Q1", data: [120, 95, 140, 60, 85], color: "#00D4FF" },
                  { label: "Q2", data: [150, 110, 160, 75, 95], color: "#00FFB3" },
                ]}
              />
            ) },
            { label: "Distribution", title: "Market Share", el: (
              <DoughnutChart
                height={220}
                labels={["Mobile", "Desktop", "Tablet", "Other"]}
                data={[58, 32, 8, 2]}
                centerLabel="100%"
              />
            ) },
            { label: "Multi-metric", title: "Brand Performance Radar", el: (
              <RadarChart
                height={240}
                labels={["Awareness", "Engagement", "Retention", "Loyalty", "Recommend", "Trust"]}
                series={[
                  { label: "Q1 2026", data: [7, 8, 6, 7, 8, 8], color: "#00D4FF" },
                  { label: "Q2 2026", data: [9, 9, 8, 8, 9, 9], color: "#7B5EA7" },
                ]}
              />
            ) },
          ].map((c, i) => (
            <StaggerItem key={i}>
              <Card hover>
                <p className="text-xs uppercase tracking-widest text-cyan mb-2 font-mono">{c.label}</p>
                <h4 className="font-syne font-semibold text-white mb-4">{c.title}</h4>
                {c.el}
              </Card>
            </StaggerItem>
          ))}
          <StaggerItem className="lg:col-span-2">
            <Card hover>
              <p className="text-xs uppercase tracking-widest text-cyan mb-2 font-mono">Stacked</p>
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
          </StaggerItem>
        </Stagger>
      </section>

      {/* ===== FEATURES — expandable pills ===== */}
      <section className="max-w-6xl mx-auto px-6 py-24 relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[480px] bg-grad-mesh opacity-50 pointer-events-none" />
        <div className="relative">
          <Reveal>
            <SectionHeader
              eyebrow="Fitur Unggulan"
              title="Lebih Cerdas, Lebih Cepat, Lebih Indah"
              description="Built untuk data analyst, scientist, marketer, dan founder. Klik untuk lihat detail tiap fitur."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <ExpandableFeatures features={features} />
          </Reveal>
        </div>
      </section>

      {/* ===== GRAFIO DIFFERENCE — WHY US (with tilt) ===== */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Yang Bikin Beda"
            title="Pengalaman Analisis yang Sebenarnya"
            description="Tools statistik biasanya kasih kamu angka. Grafio kasih kamu cerita di balik angka — dengan AI yang ngerti konteks bisnis kamu."
          />
        </Reveal>
        <Stagger className="grid md:grid-cols-2 gap-5" gap={0.09}>
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
            <StaggerItem key={i}>
              <TiltCard className="glass rounded-2xl p-6 hover:border-cyan/40 transition-colors duration-400">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                    <it.icon className="w-5 h-5 text-cyan" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-syne font-bold text-white text-lg mb-2">{it.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{it.desc}</p>
                  </div>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.2}>
          <div className="mt-10 text-center">
            <Link href="/features">
              <Button variant="ghost" size="lg">
                Lihat semua cara Grafio bekerja <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Testimoni"
            title="Apa Kata Mereka"
            description="Ribuan analyst, scientist, dan founder sudah membuktikan."
          />
        </Reveal>
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-5" gap={0.08}>
          {testimonials.map((t, i) => (
            <StaggerItem key={i}>
              <div className="group glass rounded-2xl p-6 hover-lift hover:border-cyan/40 transition-all duration-400 ease-glide shadow-soft flex flex-col h-full">
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
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <Reveal>
          <div className="relative overflow-hidden border-gradient rounded-3xl p-10 md:p-20 text-center shadow-elev-lg">
            <div className="absolute inset-0 bg-grad-mesh opacity-70 pointer-events-none" />
            <div className="glow-orb top-0 right-0 w-72 h-72 bg-cyan/30" />
            <div className="glow-orb bottom-0 left-0 w-72 h-72 bg-violet/30" />
            <div className="relative">
              <Logo className="w-20 h-20 mx-auto mb-7 animate-float" />
              <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1 rounded-full mb-6 font-mono">
                Gratis · Tanpa kartu kredit
              </span>
              <h2 className="text-3xl md:text-6xl font-syne font-extrabold text-white mb-5 leading-[1.05]">
                Siap melihat <br className="md:hidden" />
                <span className="text-gradient-violet">cerita di balik angka?</span>
              </h2>
              <p className="text-muted max-w-xl mx-auto mb-9 text-base md:text-lg leading-relaxed">
                Upload file pertamamu, dapatkan dashboard AI dengan insight lengkap dalam 30 detik.
                Tidak perlu install, tidak perlu coding.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <MagneticButton strength={0.22}>
                  <Link href="/dashboard">
                    <Button size="lg" className="group">
                      Coba Gratis Sekarang
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </MagneticButton>
                <Link href="/features">
                  <Button variant="ghost" size="lg">
                    Lihat Semua Fitur
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
