"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useReducedMotion } from "./useReducedMotion";
import { ORBIT_TERMS, type OrbitTerm } from "./orbitTerms";

// ============================================================
// CONSTANTS
// ============================================================

// Accent colors (mirror dari OrbitScene3D — kecil, sengaja duplicate
// supaya 2 file bisa standalone). Ubah di sini & di OrbitScene3D bersamaan.
const ACCENT_HEX: Record<"cyan" | "violet" | "mint", string> = {
  cyan: "#7DE3FF",
  violet: "#A78BFA",
  mint: "#00FFB3",
};

// ============================================================
// LAZY-LOAD 3D SCENE
// ============================================================

// Three.js bundle hanya di-load kalau user butuh (bukan reduced-motion).
// SSR off karena WebGL butuh window. Loading state: blank — orbit muncul
// setelah Canvas siap (parent OrbitStar.tsx udah punya skeleton).
const OrbitScene3D = dynamic(() => import("./OrbitScene3D"), {
  ssr: false,
  loading: () => null,
});

// ============================================================
// PUBLIC API
// ============================================================

type Props = {
  /** Override default terms. Default: ORBIT_TERMS dari orbitTerms.ts */
  terms?: OrbitTerm[];
  /** Canvas size in px (square). Default 480. */
  size?: number;
  /** OrbitControls autoRotateSpeed (drei units, ~0.5-1.5 sweet spot). */
  baseSpeed?: number;
  className?: string;
};

// ============================================================
// COMPONENT
// ============================================================

/**
 * OrbitStar — 3D interactive hero centerpiece untuk Grafio.
 *
 * Layout:
 * - Desktop (≥md): Canvas + side info panel. Saat label di-klik, canvas
 *   slide ke kiri (~translateX(-15%)) + panel slide in dari kanan.
 * - Mobile (<md): Canvas tetap di tengah. Saat label di-klik, panel muncul
 *   sebagai bottom-sheet di bawah canvas (stack vertical), tidak side-by-side
 *   karena layar terlalu sempit untuk geser kiri-kanan.
 *
 * Reduced motion: render static fallback (orbit visual sederhana tanpa Canvas)
 * dengan label tetap clickable untuk panel.
 *
 * A11y: label adalah <button> dengan aria-label & keyboard (Enter/Space)
 * dari OrbitScene3D. Panel close button juga focusable.
 */
export default function OrbitStar({
  terms = ORBIT_TERMS,
  size = 480,
  baseSpeed = 0.6,
  className = "",
}: Props) {
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile breakpoint via media query (no SSR mismatch — default false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const activeTerm = useMemo(
    () => terms.find((t) => t.id === activeId) ?? null,
    [terms, activeId],
  );

  const handleLabelClick = (id: string) => {
    // Toggle: klik label yang sama → close panel
    setActiveId((current) => (current === id ? null : id));
  };

  const closePanel = () => setActiveId(null);

  // ============================================================
  // RENDER — desktop layout (canvas + side panel)
  // ============================================================

  if (!isMobile) {
    return (
      <div className={`relative ${className}`} style={{ width: "100%" }}>
        <div className="relative flex items-center justify-center">
          {/* Canvas wrapper — slide left saat panel aktif */}
          <div
            className="relative transition-transform duration-600 ease-glide"
            style={{
              width: size,
              height: size,
              transform: activeTerm
                ? "translateX(-22%)"
                : "translateX(0)",
            }}
          >
            {reduced ? (
              <ReducedMotionFallback
                terms={terms}
                activeId={activeId}
                onLabelClick={handleLabelClick}
                size={size}
              />
            ) : (
              <OrbitScene3D
                terms={terms}
                activeId={activeId}
                onLabelClick={handleLabelClick}
                baseSpeed={baseSpeed}
              />
            )}
          </div>

          {/* Info panel — slide in dari kanan saat ada activeTerm */}
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-[340px] lg:w-[380px] transition-all duration-600 ease-glide ${
              activeTerm
                ? "opacity-100 translate-x-0 pointer-events-auto"
                : "opacity-0 translate-x-8 pointer-events-none"
            }`}
            aria-hidden={!activeTerm}
          >
            {activeTerm && (
              <InfoPanel term={activeTerm} onClose={closePanel} />
            )}
          </div>

          {/* Backdrop click to close — di belakang panel & canvas */}
          {activeTerm && (
            <div
              className="absolute inset-0 -z-10 cursor-pointer"
              onClick={closePanel}
              aria-hidden
            />
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER — mobile layout (canvas + bottom sheet)
  // ============================================================

  const mobileSize = Math.min(size, 280);

  return (
    <div className={`relative ${className}`} style={{ width: "100%" }}>
      <div className="flex flex-col items-center gap-5">
        {/* Canvas tetap centered, ukuran lebih kecil */}
        <div
          className="relative"
          style={{ width: mobileSize, height: mobileSize }}
        >
          {reduced ? (
            <ReducedMotionFallback
              terms={terms}
              activeId={activeId}
              onLabelClick={handleLabelClick}
              size={mobileSize}
            />
          ) : (
            <OrbitScene3D
              terms={terms}
              activeId={activeId}
              onLabelClick={handleLabelClick}
              baseSpeed={baseSpeed}
            />
          )}
        </div>

        {/* Bottom sheet panel — collapse height saat tidak aktif */}
        <div
          className={`w-full max-w-md transition-all duration-500 ease-glide overflow-hidden ${
            activeTerm ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
          }`}
          aria-hidden={!activeTerm}
        >
          {activeTerm && (
            <InfoPanel term={activeTerm} onClose={closePanel} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INFO PANEL
// ============================================================

function InfoPanel({
  term,
  onClose,
}: {
  term: OrbitTerm;
  onClose: () => void;
}) {
  // Trap focus on close button when panel opens (a11y)
  return (
    <div
      role="dialog"
      aria-labelledby={`orbit-panel-title-${term.id}`}
      className="relative glass-strong rounded-2xl p-6 md:p-7 shadow-elev-lg border border-cyan/25"
      style={{
        animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup panel"
        className="absolute top-3 right-3 w-7 h-7 rounded-md text-muted hover:text-white hover:bg-bgElevated/60 transition-colors duration-250 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Accent dot + label */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: ACCENT_HEX[term.accent],
            boxShadow: `0 0 8px ${ACCENT_HEX[term.accent]}`,
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.25em] font-mono text-cyan">
          Orbit Term
        </span>
      </div>

      <h3
        id={`orbit-panel-title-${term.id}`}
        className="font-syne font-bold text-white text-2xl md:text-3xl leading-tight mb-4"
      >
        {term.label}
      </h3>

      <div className="text-sm text-muted leading-relaxed space-y-3">
        {term.body.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <p className="text-[10px] text-muted/60 font-mono uppercase tracking-widest mt-5 pt-4 border-t border-borderColor">
        · Draft copy — dapat diubah di orbitTerms.ts
      </p>
    </div>
  );
}

// ============================================================
// REDUCED MOTION FALLBACK
// ============================================================

/**
 * Versi static 2D sederhana untuk user dengan prefers-reduced-motion.
 * Tetap interaktif (label clickable untuk open panel), tapi tanpa
 * 3D scene, tanpa auto-rotate, tanpa drag.
 */
function ReducedMotionFallback({
  terms,
  activeId,
  onLabelClick,
  size,
}: {
  terms: OrbitTerm[];
  activeId: string | null;
  onLabelClick: (id: string) => void;
  size: number;
}) {
  const half = size / 2;
  const radii = [0.85, 0.62, 0.4].map((r) => r * half);
  const perRing = Math.ceil(terms.length / 3);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-label="Visualisasi data orbit (versi statis)"
    >
      {/* Glow halo */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* Static rings via SVG */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="absolute inset-0 pointer-events-none"
      >
        {radii.map((r, i) => (
          <circle
            key={i}
            cx={half}
            cy={half}
            r={r}
            fill="none"
            stroke="rgba(0,212,255,0.22)"
            strokeWidth={1}
            strokeDasharray={i === 1 ? "3 6" : undefined}
          />
        ))}
      </svg>

      {/* Center starburst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg viewBox="0 0 200 200" width={size * 0.32} height={size * 0.32}>
          <defs>
            <radialGradient id="rmCoreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="40%" stopColor="#7DE3FF" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="80" fill="url(#rmCoreGrad)" />
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={i}
              x1="100"
              y1="100"
              x2="100"
              y2="55"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform={`rotate(${(i / 6) * 360} 100 100)`}
            />
          ))}
        </svg>
      </div>

      {/* Labels — distribute on rings */}
      {terms.map((term, idx) => {
        const ringIdx = Math.min(2, Math.floor(idx / perRing));
        const inRingIdx = idx % perRing;
        const ringSize = terms.slice(ringIdx * perRing, (ringIdx + 1) * perRing)
          .length;
        const angle = (inRingIdx / Math.max(ringSize, 1)) * Math.PI * 2;
        const r = radii[ringIdx];
        const x = half + r * Math.cos(angle);
        const y = half + r * Math.sin(angle);
        const active = activeId === term.id;
        const accent = ACCENT_HEX[term.accent];

        return (
          <button
            key={term.id}
            type="button"
            onClick={() => onLabelClick(term.id)}
            aria-label={`Lihat penjelasan ${term.label}`}
            className="absolute cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep rounded-full"
            style={{
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 999,
              border: `1px solid ${active ? accent : "rgba(255,255,255,0.08)"}`,
              background: active ? `${accent}22` : "rgba(15,26,63,0.72)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: active ? "#fff" : "rgba(241,245,255,0.88)",
              fontSize: 10,
              fontFamily: "var(--font-syne, sans-serif)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
              boxShadow: active
                ? `0 0 22px ${accent}66`
                : "0 2px 8px rgba(0,0,0,0.3)",
              transition: "background 0.3s, border-color 0.3s, color 0.3s",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: accent,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            {term.label}
          </button>
        );
      })}
    </div>
  );
}

