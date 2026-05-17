"use client";
import { ReactNode, useState } from "react";
import { Maximize2, Sparkles } from "lucide-react";
import Logo from "../Logo";
import ChartDetailModal from "./ChartDetailModal";
import type { ChartKind, ColumnRole } from "@/lib/charts/tutorials";

type Props = {
  /** Stable identifier for Q&A engine reference & modal targeting (poin 6). */
  id?: string;
  /** Friendly chart name shown big in the frame (poin 6 — kekal & gampang dipanggil). */
  name: string;
  /** Short category tag (Trend, Distribution, Correlation, dst). */
  category?: string;
  /** Subtitle/short caption under name. */
  subtitle?: string;
  /** Source file name → ditampilkan di footer (untuk attribution saat di-screenshot). */
  source?: string;
  /** Override the date stamp di footer. Default: hari ini. */
  date?: string;
  /** AI-generated 1-3 sentence insight tampil di bawah chart (poin 5). */
  insight?: ReactNode;
  /**
   * Info detail untuk modal "dive deeper" (poin 2):
   * - chartKind: tipe chart untuk tutorial generator
   * - columnsUsed: kolom apa saja yang dipakai chart
   * - renderChart: callback yang render ulang chart dengan height besar untuk modal
   * Kalau prop ini diisi, hover akan menampilkan "Dive Deeper" button (poin 3).
   */
  detail?: {
    chartKind: ChartKind;
    columnsUsed: ColumnRole[];
    renderChart: (height: number) => ReactNode;
  };
  /** Tambahan className untuk outer wrapper (mis. md:col-span-2). */
  className?: string;
  /** Chart content. */
  children: ReactNode;
};

const formatDate = (d: Date) =>
  d.toLocaleDateString("id", { day: "numeric", month: "short", year: "numeric" });

/**
 * Screenshot-ready chart shell.
 *
 * Kenapa wrapper baru (bukan reuse <Card />):
 * - Background SOLID (bukan glass/transparent) — penting biar screenshot
 *   tidak nempel jadi blob biru samar di slide putih.
 * - Branding kecil di footer (Grafio + source + tanggal) — kalau user paste
 *   ke deck/medsos, attribution tetap ikut.
 * - Header lebih prominent: nama chart besar (font-syne), bukan label kecil.
 * - Structural slot untuk insight (poin 5) & dive-deeper (poin 2-3).
 */
export default function ChartFrame({
  id,
  name,
  category,
  subtitle,
  source,
  date,
  insight,
  detail,
  className = "",
  children,
}: Props) {
  const stamp = date ?? formatDate(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const canDiveDeeper = !!detail;

  return (
    <div
      id={id}
      data-chart-name={name}
      data-chart-id={id}
      className={`group relative bg-bgSurface border border-borderColor rounded-xl overflow-hidden shadow-soft transition-all duration-300 ${
        canDiveDeeper
          ? "hover:border-cyan/60 hover:shadow-glow hover:-translate-y-1 hover:scale-[1.01]"
          : ""
      } ${className}`}
    >
      {/* Top accent bar — subtle gradient strip, jadi screenshot kelihatan punya branding */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan/60 via-violet/40 to-mint/40" />

      {/* HEADER — chart name & category */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0 flex-1">
            {category && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan mb-1 font-medium">
                {category}
              </p>
            )}
            <h3 className="font-syne font-bold text-white text-base leading-tight">
              {name}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* CHART AREA */}
      <div className="px-5 pb-2">{children}</div>

      {/* AI INSIGHT SLOT — placeholder, diisi di commit poin 5 */}
      {insight && (
        <div className="mx-5 mb-3 mt-1 rounded-md border border-violet/25 bg-violet/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <div className="w-1 h-full self-stretch min-h-[24px] bg-gradient-to-b from-violet to-mint rounded-full flex-shrink-0" />
            <div className="text-xs text-white leading-relaxed flex-1">{insight}</div>
          </div>
        </div>
      )}

      {/* FOOTER — branding & source (penting untuk screenshot context) */}
      <div className="px-5 py-2.5 border-t border-borderColor bg-bgDeep/40 flex items-center justify-between gap-3 text-[10px] text-muted">
        <div className="flex items-center gap-1.5 min-w-0">
          <Logo className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
          <span className="font-syne font-bold text-cyan tracking-wider">GRAFIO</span>
          {source && (
            <>
              <span className="text-muted/50">·</span>
              <span className="truncate font-mono" title={source}>
                {source}
              </span>
            </>
          )}
        </div>
        <span className="font-mono flex-shrink-0">{stamp}</span>
      </div>

      {/* DIVE DEEPER AFFORDANCE (poin #3) — dua lapis biar chart tidak ke-blok:
          1. Kecil persistent icon di header (kanan atas) untuk touch / cepat
          2. Floating pill di tengah saat hover, dengan tagline ramah
          3. Whole-frame click jadi shortcut (cursor-zoom-in di desktop) */}
      {canDiveDeeper && (
        <>
          {/* Persistent corner button — selalu visible (untuk mobile/touch) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            aria-label={`Pelajari lebih dalam tentang ${name}`}
            title="Pelajari lebih dalam"
            className="absolute top-3 right-3 z-20 w-7 h-7 rounded-md bg-bgElevated/80 border border-borderColor text-muted hover:bg-cyan/15 hover:border-cyan hover:text-cyan transition-all flex items-center justify-center backdrop-blur-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Hover invitation pill — clickable, tampil di bawah-tengah saat hover desktop.
              Tidak nutupin chart, hanya melayang di atas footer. Tetap bisa di-klik
              karena posisinya di area branding footer (bukan chart canvas). */}
          <button
            onClick={() => setModalOpen(true)}
            aria-label={`Pelajari lebih dalam tentang ${name}`}
            className="hidden md:flex absolute bottom-12 left-1/2 -translate-x-1/2 z-20 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
          >
            <span className="px-3.5 py-1.5 rounded-full bg-cyan text-bgDeep text-xs font-syne font-bold shadow-glow flex items-center gap-1.5 whitespace-nowrap hover:bg-cyanSoft transition-colors">
              <Sparkles className="w-3 h-3" />
              Eh, pelajari lebih dalam yuk →
            </span>
          </button>
        </>
      )}

      {/* FULL-SCREEN DETAIL MODAL */}
      {detail && (
        <ChartDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          id={id}
          name={name}
          category={category}
          subtitle={subtitle}
          source={source}
          insight={typeof insight === "string" ? insight : undefined}
          chartKind={detail.chartKind}
          columnsUsed={detail.columnsUsed}
          renderChart={detail.renderChart}
        />
      )}
    </div>
  );
}
