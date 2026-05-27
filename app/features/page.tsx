"use client";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import LineAreaChart from "@/components/ui/charts/LineAreaChart";
import Reveal from "@/components/ui/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/ui/motion/Stagger";
import MagneticButton from "@/components/ui/motion/MagneticButton";
import {
  Brain, MessageSquare, Wand2, Workflow, Eye, ShieldCheck,
  FileDown, Layers, Database, Zap, ArrowRight,
  Activity, Lightbulb, Heart, Sparkles,
  CheckCircle2, MessageCircle,
} from "lucide-react";

// ============================================================
// CONTENT
// ============================================================

const flowSteps = [
  {
    num: "01",
    icon: Activity,
    title: "Health Check Otomatis",
    blurb: "Begitu kamu upload, Grafio langsung baca isi datamu dan kasih Health Score 0–100.",
    detail: "AI mendeteksi sel kosong, baris duplikat, kolom konstan, nilai ekstrem, dan kolom yang mungkin teks bebas. Setiap anomali dijelaskan dampaknya ke analisis — bukan cuma daftar masalah.",
    accent: "cyan",
  },
  {
    num: "02",
    icon: Wand2,
    title: "Auto Cleaning Pilih Sendiri",
    blurb: "Pilih anomali mana yang mau dibereskan AI, anomali mana yang kamu pertahankan.",
    detail: "Kadang \"outlier\" justru data emas — misal lonjakan penjualan karena kampanye Ramadhan. Kamu yang putuskan, AI yang eksekusi: median imputation, IQR capping, dedupe — pilih metodenya.",
    accent: "violet",
  },
  {
    num: "03",
    icon: MessageCircle,
    title: "Konfirmasi Konteks",
    blurb: "Grafio kasih lihat pemahamannya tentang datamu. Kamu koreksi kalau ada yang salah.",
    detail: "Ini fitur yang nggak ada di tools lain: AI nggak sok tahu. Kamu bisa nambah konteks bisnis (mis. \"data ini Q2 saat kami baru launch produk baru\") — AI ingat dan pakai untuk analisis & chat.",
    accent: "mint",
  },
  {
    num: "04",
    icon: Lightbulb,
    title: "Analisis + Kesimpulan AI",
    blurb: "Hasil analisis lengkap dengan KESIMPULAN AI sendiri — bukan cuma chart.",
    detail: "Grafio narik kesimpulan dengan sudut pandang, pakai bahasa awam + analogi. \"Momentum panas di kategori X\", bukan \"trend dengan R² 0.85\". Bisa Q&A lanjutan, semua context-aware.",
    accent: "purple",
  },
];

const ACCENT_CLASS: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  cyan: { bg: "bg-cyan/10", border: "border-cyan/30", text: "text-cyan", ring: "ring-cyan/40" },
  violet: { bg: "bg-violet/12", border: "border-violet/30", text: "text-violetSoft", ring: "ring-violet/40" },
  mint: { bg: "bg-mint/10", border: "border-mint/30", text: "text-mint", ring: "ring-mint/40" },
  purple: { bg: "bg-purple/12", border: "border-purple/30", text: "text-purple", ring: "ring-purple/40" },
};

const uniqueFeatures = [
  {
    icon: Brain,
    title: "Konteks-Aware Sejak Awal",
    desc: "Sebelum analisis, AI tanya \"apakah pemahamanku benar?\". Kamu bisa koreksi — AI ingat & pakai konteks itu di semua jawaban berikutnya.",
  },
  {
    icon: Heart,
    title: "Health Score Real-time",
    desc: "Skor 0–100 yang berubah saat kamu pilih anomali untuk diperbaiki. Liat data sebelum & sesudah cleaning side-by-side.",
  },
  {
    icon: Lightbulb,
    title: "Kesimpulan AI Bersudut Pandang",
    desc: "Bukan ringkasan generik — Grafio kasih takeaway dengan sudut pandang. \"Momentum panas\", \"sinyal melemah\", bukan jargon statistik kering.",
  },
  {
    icon: MessageSquare,
    title: "Bahasa Awam + Analogi",
    desc: "Korelasi r=0.85 dijelaskan sebagai \"seperti tinggi & berat badan — satu naik, yang lain pasti ikut\". Orang non-statistik tetap paham.",
  },
  {
    icon: Eye,
    title: "Anomali = Penjelasan, Bukan Daftar",
    desc: "Setiap anomali yang terdeteksi dijelaskan dampaknya: \"bikin rata-rata bias\", \"membuat korelasi palsu\" — dan saran perbaikannya.",
  },
  {
    icon: Workflow,
    title: "Per-Issue Selection",
    desc: "Bukan all-or-nothing cleaning. Per anomali bisa kamu pilih: perbaiki atau pertahankan. AI cuma tools, keputusan tetap di kamu.",
  },
  {
    icon: Sparkles,
    title: "Q&A Context-Aware",
    desc: "Chat AI ingat seluruh konteks: data, kesimpulan sebelumnya, konteks bisnis kamu. Follow-up question nyambung, bukan reset.",
  },
  {
    icon: FileDown,
    title: "PDF Report Berbahasa Manusia",
    desc: "Laporan PDF ditulis seperti analyst senior menjelaskan ke direksi — bukan dump tabel. Siap presentasi.",
  },
  {
    icon: Database,
    title: "Format Lengkap",
    desc: "CSV, TSV, Excel, JSON, JSONL. Engine local-first — data tidak meninggalkan browser saat parsing & cleaning.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy by Design",
    desc: "Parsing & cleaning jalan di browser kamu. Hanya statistik agregat yang dikirim ke AI untuk narasi — bukan raw data.",
  },
  {
    icon: Zap,
    title: "Engine Lokal Statistik",
    desc: "OLS regression, Pearson correlation, Z-score, IQR — semua jalan di browser. Hasil deterministic, cepat, gratis.",
  },
  {
    icon: Layers,
    title: "Auto Chart Recommendation",
    desc: "Engine pilih chart paling pas berdasarkan tipe & distribusi data: line untuk time-series, doughnut untuk distribusi, scatter untuk korelasi.",
  },
];

export default function Features() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-24">
        <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
        <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <Reveal>
            <p className="inline-block text-[11px] font-mono uppercase tracking-[0.25em] text-cyan border border-cyan/30 bg-cyan/5 px-3 py-1.5 rounded-full mb-6">
              Cara Grafio Bekerja
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-4xl md:text-7xl font-syne font-extrabold text-white leading-[1.02]">
              Bukan cuma chart cantik. <br />
              <span className="text-gradient">Analisis yang ngerti datamu.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="text-muted max-w-2xl mx-auto mt-7 text-lg md:text-xl leading-relaxed">
              Grafio dirancang untuk satu tujuan: kasih kamu pengalaman analisis data yang
              sebenarnya — AI yang baca konteks, jelasin pakai bahasa manusia, dan kasih kesimpulan
              dengan sudut pandang. Bukan tools generik.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== 4-STEP FLOW SHOWCASE ===== */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <Reveal>
          <SectionHeader
            eyebrow="Alur Unik Grafio"
            title="Dari Upload sampai Kesimpulan, 4 Langkah Saja"
            description="Setiap langkah punya peran. Kamu yang putuskan, AI yang eksekusi — kombinasi yang membuat hasil analisis bermakna, bukan asal jadi."
          />
        </Reveal>

        <Stagger className="space-y-6" gap={0.12}>
          {flowSteps.map((step, i) => {
            const a = ACCENT_CLASS[step.accent];
            const reverse = i % 2 === 1;
            return (
              <StaggerItem key={step.num}>
                <div
                  id={`flow-${step.num}`}
                  className={`glass rounded-2xl p-7 md:p-9 grid md:grid-cols-12 gap-6 items-center ${a.border} border hover-lift transition-all duration-400 ease-glide`}
                >
                  <div className={`md:col-span-3 ${reverse ? "md:order-2" : ""}`}>
                    <div className="flex items-center gap-4">
                      <div className={`relative w-20 h-20 rounded-2xl ${a.bg} border ${a.border} flex items-center justify-center`}>
                        <step.icon className={`w-8 h-8 ${a.text}`} />
                        <span className={`absolute -top-2 -right-2 text-[10px] font-mono font-bold ${a.text} ${a.bg} border ${a.border} rounded-full w-8 h-8 flex items-center justify-center`}>
                          {step.num}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`md:col-span-9 ${reverse ? "md:order-1" : ""}`}>
                    <h3 className="font-syne font-bold text-white text-2xl mb-2">{step.title}</h3>
                    <p className={`text-base ${a.text} mb-3 font-medium leading-relaxed`}>
                      {step.blurb}
                    </p>
                    <p className="text-muted text-sm leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* ===== TWO-COL HIGHLIGHT ===== */}
      <Stagger as="section" className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-6 items-stretch" gap={0.1}>
        <StaggerItem>
        <Card glass className="!p-8 h-full">
          <p className="text-xs uppercase tracking-widest text-cyan mb-2">Time-Series Engine</p>
          <h3 className="text-2xl font-syne font-bold text-white mb-3">Tren Otomatis + Forecast</h3>
          <p className="text-muted mb-5 text-sm leading-relaxed">
            Engine mendeteksi pola time-series otomatis, jalankan OLS regression, dan kasih
            forecast 3 periode ke depan beserta confidence level. Semua dijelaskan dalam bahasa
            sehari-hari — &ldquo;momentum naik konsisten&rdquo;, bukan &ldquo;R² = 0.85&rdquo;.
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
        </StaggerItem>
        <StaggerItem>
        <Card glass className="!p-8 flex flex-col h-full">
          <p className="text-xs uppercase tracking-widest text-purple mb-2">Kesimpulan AI</p>
          <h3 className="text-2xl font-syne font-bold text-white mb-3">Sudut Pandang, Bukan Ringkasan</h3>
          <p className="text-muted mb-5 text-sm leading-relaxed">
            Tools lain kasih kamu tabel statistik. Grafio kasih kamu <em>opini</em> berdasarkan
            data — pakai analogi, sentimen pasar, dan bahasa yang dipahami direksi.
          </p>
          <div className="rounded-xl border border-purple/20 bg-purple/5 p-5 flex-1 flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3" /> Contoh Kesimpulan Grafio
            </p>
            <p className="text-sm text-white italic leading-relaxed">
              &ldquo;Secara keseluruhan data e-commerce ini menunjukkan momentum yang sangat panas
              di kategori fashion (+34.2%) — pergerakan ini secara konsisten. Bila pola ini
              bertahan, revenue Juli berpotensi tembus Rp 1.2M. Anomali di Mei kemungkinan
              kampanye Ramadhan, bukan masalah data.&rdquo;
            </p>
          </div>
        </Card>
        </StaggerItem>
      </Stagger>

      {/* ===== UNIQUE FEATURES GRID ===== */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <SectionHeader
            eyebrow="Yang Bikin Beda"
            title="Pengalaman Analisis yang Sebenarnya"
            description="Setiap fitur dirancang supaya kamu bukan cuma dapat chart, tapi paham datamu — bahkan kalau kamu bukan data scientist."
          />
        </Reveal>
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" gap={0.06}>
          {uniqueFeatures.map((f, i) => (
            <StaggerItem key={i}>
              <div className="h-full glass rounded-xl p-6 hover:border-cyan/40 hover-lift transition-all duration-400 ease-glide group">
                <div className="w-11 h-11 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center mb-4 group-hover:bg-cyan transition-colors duration-400">
                  <f.icon className="w-5 h-5 text-cyan group-hover:text-bgDeep transition-colors duration-400" />
                </div>
                <h3 className="font-syne font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== WHAT GRAFIO IS NOT ===== */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <Reveal>
        <Card glass className="!p-9 border border-mint/20 bg-gradient-to-br from-mint/5 to-transparent">
          <p className="text-xs uppercase tracking-widest text-mint mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" /> Filosofi Kami
          </p>
          <h3 className="text-2xl md:text-3xl font-syne font-bold text-white mb-5 leading-tight">
            Grafio dibangun karena tools yang ada terlalu &ldquo;teknis&rdquo; — atau terlalu &ldquo;dumb&rdquo;.
          </h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed">
            <div>
              <p className="font-syne font-semibold text-cyan mb-2">Kami percaya:</p>
              <ul className="space-y-2 text-white">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-mint mt-0.5 flex-shrink-0" />
                  <span>AI yang minta konfirmasi konteks &gt; AI yang nebak buta</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-mint mt-0.5 flex-shrink-0" />
                  <span>Analogi dari kehidupan sehari-hari &gt; rumus statistik telanjang</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-mint mt-0.5 flex-shrink-0" />
                  <span>Per-anomali pilihan user &gt; auto-clean satu-tombol-semua</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-mint mt-0.5 flex-shrink-0" />
                  <span>Kesimpulan bersudut pandang &gt; ringkasan statistik kering</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-syne font-semibold text-purple mb-2">Yang kami hindari:</p>
              <ul className="space-y-2 text-muted">
                <li>• AI black-box yang langsung kasih jawaban tanpa konteks</li>
                <li>• Wizard cleaning satu-langkah yang membuang data berharga</li>
                <li>• Insight generik (&ldquo;data Anda memiliki tren&rdquo;)</li>
                <li>• Jargon statistik yang bikin orang non-teknis menyerah</li>
              </ul>
            </div>
          </div>
        </Card>
        </Reveal>
      </section>

      {/* ===== CTA ===== */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-syne font-bold text-white mb-5 leading-tight">
            Coba pengalamannya sendiri.
          </h2>
          <p className="text-muted mb-10 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
            Upload satu file kecil aja — kamu akan langsung paham kenapa kami bilang Grafio
            beda. Gratis selamanya untuk file standar.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <MagneticButton strength={0.22}>
              <Link href="/dashboard">
                <Button size="lg">
                  Buka Workspace <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </MagneticButton>
            <Link href="/pricing">
              <Button variant="ghost" size="lg">
                Lihat Pricing
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
