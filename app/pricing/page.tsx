"use client";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import FaqAccordion from "@/components/ui/FaqAccordion";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import Reveal from "@/components/ui/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/ui/motion/Stagger";
import MagneticButton from "@/components/ui/motion/MagneticButton";
import Link from "next/link";
import {
  Check, Crown, Rocket, Sparkles, GraduationCap, Zap, Clock,
} from "lucide-react";

type Tier = {
  name: string;
  price: string;
  priceNote: string;
  icon: any;
  highlight?: boolean;
  badge?: string;
  bullets: string[];
  limits: string[];
  cta: string;
  ctaHref: string;
  /** Kalau true, paket ini belum dijual — tombol di-disable jadi "Coming Soon". */
  comingSoon?: boolean;
};

const tiers: Tier[] = [
  {
    name: "FREE",
    price: "Rp 0",
    priceNote: "/selamanya",
    icon: Sparkles,
    bullets: [
      "3-5 prompt analisis per 6 jam",
      "Auto chart selection",
      "Engine statistik dasar",
      "Insight Bahasa Indonesia",
      "Export PDF report",
    ],
    limits: ["Limit token per prompt", "Watermark Grafio di PDF", "Tanpa multi-file"],
    cta: "Mulai Gratis",
    ctaHref: "/signup",
  },
  {
    name: "STUDENT",
    price: "Rp 49.000",
    priceNote: "/bulan",
    icon: GraduationCap,
    highlight: true,
    badge: "Paling Populer",
    bullets: [
      "Semua fitur Free",
      "Wajib NRP + nama institusi",
      "20-30 prompt per 6 jam",
      "Output lebih variatif & detail",
      "Multi-file upload (max 3)",
      "Tanpa watermark",
      "Email support 1×24 jam",
    ],
    limits: ["Limit lebih longgar dari Free", "Verifikasi institusi"],
    cta: "Coming Soon",
    ctaHref: "#",
    comingSoon: true,
  },
  {
    name: "PRO",
    price: "Rp 159.000",
    priceNote: "/bulan",
    icon: Rocket,
    bullets: [
      "Semua fitur lengkap Grafio",
      "Auto-cleaning + transform",
      "Forecast + correlation matrix",
      "Multi-file unlimited",
      "PPT + Excel export",
      "API access (planned)",
      "Priority support",
    ],
    limits: [
      "Tetap ada batas token (longgar)",
      "Tambah token: Rp 25k / 100k token",
    ],
    cta: "Coming Soon",
    ctaHref: "#",
    comingSoon: true,
  },
  {
    name: "CUSTOM",
    price: "Hubungi",
    priceNote: "tim sales",
    icon: Crown,
    bullets: [
      "Free Roam — semua fitur",
      "Token & prompt unlimited",
      "On-premise opsional",
      "Custom branding & domain",
      "SSO + role-based access",
      "Dedicated CSM + SLA 99.9%",
      "Training tim disertakan",
    ],
    limits: ["Negosiasi sesuai kebutuhan"],
    cta: "Coming Soon",
    ctaHref: "#",
    comingSoon: true,
  },
];

export default function Pricing() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Pricing"
            title="Plan Sesuai Kebutuhan Anda"
            description="Sekarang semua fitur Grafio bisa dipakai GRATIS sebagai pratinjau. Paket berbayar akan segera tersedia."
          />
        </Reveal>

        {/* GLOBAL COMING SOON BANNER */}
        <Reveal delay={0.05}>
        <div className="mb-14 max-w-5xl mx-auto">
          <div className="relative glass rounded-2xl p-6 md:p-7 overflow-hidden border border-cyan/20">
            <div className="absolute inset-0 bg-grad-hero opacity-40 pointer-events-none" />
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative flex items-center gap-5 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-cyan" />
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-syne font-bold text-white text-lg">
                    Pembayaran segera dibuka
                  </p>
                  <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/30">
                    Coming Soon
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  Kami sedang menyiapkan sistem billing yang aman (Stripe + Midtrans). Sementara
                  itu, <span className="text-cyan font-semibold">semua fitur tersedia gratis</span> untuk
                  early users yang membantu kami iterasi produk.
                </p>
              </div>
              <MagneticButton strength={0.2}>
                <Link href="/dashboard">
                  <Button size="lg">
                    <Sparkles className="w-4 h-4" /> Coba Sekarang Gratis
                  </Button>
                </Link>
              </MagneticButton>
            </div>
          </div>
        </div>
        </Reveal>

        {/* TIERS */}
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-4 gap-5" gap={0.08}>
          {tiers.map((t) => (
            <StaggerItem
              key={t.name}
              className={`relative rounded-2xl p-6 transition-all duration-400 ease-glide flex flex-col hover-lift ${
                t.highlight
                  ? "border-2 border-cyan/60 bg-gradient-to-b from-cyan/8 to-transparent shadow-glow"
                  : "border border-borderColor bg-bgSurface hover:border-cyan/45"
              } ${t.comingSoon ? "opacity-90" : ""}`}
            >
              {t.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan text-bgDeep text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  {t.badge}
                </span>
              )}
              {t.comingSoon && !t.badge && (
                <span className="absolute -top-3 right-4 bg-bgDeep border border-cyan/40 text-cyan text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Soon
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
                  <t.icon className="w-4 h-4 text-cyan" />
                </div>
                <h3 className="font-syne font-bold text-white">{t.name}</h3>
              </div>
              <p className="text-3xl font-syne font-extrabold text-white mb-1">{t.price}</p>
              <p className="text-xs text-muted mb-5">{t.priceNote}</p>

              <p className="text-[10px] uppercase tracking-widest text-cyan mb-2">
                Fitur
              </p>
              <ul className="space-y-2 mb-5 text-sm flex-1">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-muted">
                    <Check className="w-4 h-4 text-mint flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <p className="text-[10px] uppercase tracking-widest text-warning mb-2">
                Catatan
              </p>
              <ul className="space-y-1 mb-5 text-[11px]">
                {t.limits.map((b) => (
                  <li key={b} className="text-muted/80 leading-relaxed">
                    · {b}
                  </li>
                ))}
              </ul>

              {t.comingSoon ? (
                <button
                  type="button"
                  disabled
                  title="Pembayaran sedang dipersiapkan — akan tersedia segera"
                  className="w-full rounded-md font-medium font-syne tracking-wide px-5 py-2.5 text-sm border border-borderColor text-muted bg-bgGlass cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5" /> Coming Soon
                </button>
              ) : (
                <Link href={t.ctaHref}>
                  <Button variant={t.highlight ? "primary" : "ghost"} className="w-full">
                    {t.cta}
                  </Button>
                </Link>
              )}
            </StaggerItem>
          ))}
        </Stagger>

        {/* TOKEN ADD-ON — locked until billing ready */}
        <Reveal delay={0.1}>
        <div className="mt-20 max-w-3xl mx-auto">
          <Card glass>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-purple" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-syne font-bold text-white">Token Top-up untuk Plan Pro</p>
                  <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/30 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Coming Soon
                  </span>
                </div>
                <p className="text-sm text-muted mb-3">
                  Habiskan kuota token bulanan? Tambah kapasitas tanpa upgrade plan. Akan aktif bersama paket berbayar.
                </p>
                <div className="grid grid-cols-3 gap-3 opacity-60">
                  <div className="border border-borderColor rounded-md p-3 text-center">
                    <p className="font-mono text-xs text-muted">100K token</p>
                    <p className="font-syne font-bold text-white text-lg mt-1">Rp 25.000</p>
                  </div>
                  <div className="border border-cyan/40 rounded-md p-3 text-center bg-cyan/5">
                    <p className="font-mono text-xs text-muted">500K token</p>
                    <p className="font-syne font-bold text-white text-lg mt-1">Rp 99.000</p>
                    <p className="text-[10px] text-mint">hemat 21%</p>
                  </div>
                  <div className="border border-borderColor rounded-md p-3 text-center">
                    <p className="font-mono text-xs text-muted">1M token</p>
                    <p className="font-syne font-bold text-white text-lg mt-1">Rp 179.000</p>
                    <p className="text-[10px] text-mint">hemat 28%</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
        </Reveal>

        <Reveal>
          <FaqAccordion />
        </Reveal>
      </div>
      <Footer />
    </main>
  );
}
