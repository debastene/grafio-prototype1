"use client";
import { ReactNode, useEffect, useState } from "react";
import { X, BookOpen, Brain, Settings2, Layers, FileSpreadsheet, Sparkles } from "lucide-react";
import Logo from "../Logo";
import {
  buildAllTutorials,
  chartKindLabel,
  type ChartKind,
  type ColumnRole,
} from "@/lib/charts/tutorials";

export type ChartDetailModalProps = {
  open: boolean;
  onClose: () => void;
  /** Chart identity */
  id?: string;
  name: string;
  category?: string;
  subtitle?: string;
  source?: string;
  /** AI-generated insight (1-3 sentences) */
  insight?: string;
  /** Chart kind for tutorial generation */
  chartKind: ChartKind;
  /** Columns yang dipakai chart (untuk tutorial & info panel) */
  columnsUsed: ColumnRole[];
  /** Render the chart big — modal calls this with the available height */
  renderChart: (height: number) => ReactNode;
};

/**
 * Full-screen chart detail modal (poin #2 evaluasi 16 Mei).
 *
 * Layout:
 *   ┌─ Header (close, name, category)
 *   ├─ Left: Chart BIG  |  Right: Tabs (Settings, AI Insight, Tutorial)
 *   └─ Footer: source, attribution
 */
export default function ChartDetailModal({
  open,
  onClose,
  id,
  name,
  category,
  subtitle,
  source,
  insight,
  chartKind,
  columnsUsed,
  renderChart,
}: ChartDetailModalProps) {
  const [tab, setTab] = useState<"settings" | "insight" | "tutorial">("settings");
  const [activePlatform, setActivePlatform] = useState<"excel" | "sheets" | "powerbi">("excel");

  // Lock body scroll while open + close on Escape.
  // Kompensasi scrollbar width supaya halaman di belakang tidak SHIFT ke kanan
  // saat scrollbar disembunyikan — penyebab "flickering" yang terlihat user.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const tutorials = buildAllTutorials(chartKind, columnsUsed);
  const activeTut = tutorials.find((t) => t.platform === activePlatform)!;

  return (
    <div
      className="fixed inset-0 z-[100] bg-bgDeep/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 modal-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`modal-${id}-title`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-bgSurface border border-borderColor rounded-2xl shadow-elev-lg w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col modal-panel-in"
      >
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-cyan via-violet to-mint" />

        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-borderColor">
          <div className="min-w-0 flex-1">
            {category && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan mb-1 font-medium">
                {category}
              </p>
            )}
            <h2
              id={`modal-${id}-title`}
              className="font-syne font-bold text-white text-xl leading-tight"
            >
              {name}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-md border border-borderColor text-muted hover:text-white hover:border-cyan transition-colors flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY: chart kiri, panel kanan */}
        <div className="flex-1 grid lg:grid-cols-5 gap-0 overflow-hidden">
          {/* CHART AREA (3/5 di desktop, full di mobile) */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-borderColor p-6 overflow-auto flex flex-col">
            <div className="flex-1 min-h-[360px]">{renderChart(420)}</div>
            {/* Footer kecil di bawah chart untuk hint screenshot */}
            <div className="mt-4 flex items-center justify-between text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <Logo className="w-3.5 h-3.5 opacity-80" />
                <span className="font-syne font-bold text-cyan tracking-wider">GRAFIO</span>
                {source && (
                  <>
                    <span className="text-muted/50">·</span>
                    <span className="font-mono truncate" title={source}>
                      {source}
                    </span>
                  </>
                )}
              </span>
              <span className="font-mono">{new Date().toLocaleDateString("id", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>

          {/* SIDE PANEL (2/5 di desktop) */}
          <div className="lg:col-span-2 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-borderColor bg-bgDeep/40">
              <TabButton
                active={tab === "settings"}
                onClick={() => setTab("settings")}
                icon={<Settings2 className="w-3.5 h-3.5" />}
                label="Settings"
              />
              <TabButton
                active={tab === "insight"}
                onClick={() => setTab("insight")}
                icon={<Brain className="w-3.5 h-3.5" />}
                label="AI Insight"
              />
              <TabButton
                active={tab === "tutorial"}
                onClick={() => setTab("tutorial")}
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Cara Bikin Sendiri"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "settings" && (
                <SettingsPanel
                  chartKind={chartKind}
                  columnsUsed={columnsUsed}
                  source={source}
                />
              )}
              {tab === "insight" && <InsightPanel insight={insight} />}
              {tab === "tutorial" && (
                <TutorialPanel
                  tutorials={tutorials}
                  activePlatform={activePlatform}
                  setActivePlatform={setActivePlatform}
                  activeTut={activeTut}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-syne font-semibold transition-all border-b-2 ${
        active
          ? "text-cyan border-cyan bg-cyan/5"
          : "text-muted border-transparent hover:text-white hover:bg-bgElevated/40"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SettingsPanel({
  chartKind,
  columnsUsed,
  source,
}: {
  chartKind: ChartKind;
  columnsUsed: ColumnRole[];
  source?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">Tipe Chart</p>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan" />
          <span className="text-sm text-white font-syne font-semibold">
            {chartKindLabel(chartKind)}
          </span>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
          Kolom yang Dipakai
        </p>
        {columnsUsed.length === 0 ? (
          <p className="text-xs text-muted italic">
            Tidak ada info kolom — chart pakai data agregat engine.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {columnsUsed.map((c) => (
              <li
                key={c.name}
                className="text-xs rounded-md border border-borderColor bg-bgElevated/40 px-2.5 py-1.5"
              >
                <span className="font-mono text-cyan">{c.name}</span>
                <span className="text-muted"> — {c.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {source && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Sumber Data</p>
          <p className="text-xs text-white font-mono flex items-center gap-1.5">
            <FileSpreadsheet className="w-3 h-3 text-muted" /> {source}
          </p>
        </div>
      )}

      <div className="rounded-md border border-cyan/25 bg-cyan/5 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-widest text-cyan mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Tips Screenshot
        </p>
        <p className="text-[11px] text-white leading-relaxed">
          Chart sudah punya background solid + branding Grafio.{" "}
          <span className="text-muted">
            Pakai screenshot tool (Win + Shift + S / Cmd + Shift + 4) lalu crop ke area chart.
          </span>
        </p>
      </div>
    </div>
  );
}

function InsightPanel({ insight }: { insight?: string }) {
  if (!insight) {
    return (
      <div className="text-center py-8 text-muted">
        <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-xs leading-relaxed max-w-xs mx-auto">
          AI belum sempat generate insight untuk chart ini. Coba refresh halaman atau cek koneksi.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet/15 border border-violet/30 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-violet" />
        </div>
        <p className="font-syne font-bold text-white text-sm">Apa Artinya Chart Ini?</p>
      </div>
      <div className="rounded-md border border-violet/25 bg-violet/5 px-3.5 py-3">
        <p className="text-sm text-white leading-relaxed">{insight}</p>
      </div>
      <p className="text-[10px] text-muted italic leading-relaxed">
        Insight di-generate oleh Grafio AI berdasarkan data & domain. Bukan saran finansial /
        keputusan bisnis — verifikasi dengan konteks kamu sendiri.
      </p>
    </div>
  );
}

function TutorialPanel({
  tutorials,
  activePlatform,
  setActivePlatform,
  activeTut,
}: {
  tutorials: ReturnType<typeof buildAllTutorials>;
  activePlatform: "excel" | "sheets" | "powerbi";
  setActivePlatform: (p: "excel" | "sheets" | "powerbi") => void;
  activeTut: ReturnType<typeof buildAllTutorials>[number];
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
          Cara bikin chart ini di:
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {tutorials.map((t) => (
            <button
              key={t.platform}
              onClick={() => setActivePlatform(t.platform)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-all flex items-center gap-1.5 ${
                t.platform === activePlatform
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-borderColor text-muted hover:border-cyan/50 hover:text-white"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <ol className="space-y-2.5">
        {activeTut.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan/15 border border-cyan/30 text-cyan text-[10px] font-syne font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span
              className="text-xs text-white leading-relaxed flex-1"
              // Render backticks as inline code
              dangerouslySetInnerHTML={{
                __html: step
                  .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-bgElevated text-cyan text-[10px] font-mono">$1</code>')
                  .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-cyan font-semibold">$1</strong>'),
              }}
            />
          </li>
        ))}
      </ol>

      <p className="text-[10px] text-muted italic leading-relaxed pt-2 border-t border-borderColor">
        Tutorial singkat — kalau butuh detail, cek dokumentasi resmi platform. Step bisa beda
        sedikit antar versi aplikasi.
      </p>
    </div>
  );
}
