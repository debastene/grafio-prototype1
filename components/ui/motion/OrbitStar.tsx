"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  CSSProperties,
} from "react";
import { useReducedMotion } from "./useReducedMotion";

// ============================================================
// TYPES
// ============================================================

type Theme = {
  /** Center orb base color (cyan-ish, used in radial gradient core). */
  core: string;
  /** Ring stroke color. */
  ring: string;
  /** Palette siklik untuk node dots & pill borders. */
  nodes: string[];
};

type Props = {
  size?: number;
  labels?: string[];
  ringCount?: 2 | 3;
  /** Base auto-rotate speed, degrees per second. */
  baseSpeed?: number;
  theme?: Partial<Theme>;
  className?: string;
};

// ============================================================
// DEFAULTS (Grafio brand)
// ============================================================

const DEFAULT_THEME: Theme = {
  core: "#00D4FF",
  ring: "rgba(0,212,255,0.22)",
  nodes: ["#7DE3FF", "#A78BFA", "#00FFB3", "#00D4FF", "#8B5CF6"],
};

const DEFAULT_LABELS = [
  "Revenue",
  "Users",
  "Growth",
  "Churn",
  "Trends",
  "Signals",
  "Anomaly",
  "Forecast",
  "Margin",
  "Retention",
];

// ============================================================
// COMPONENT
// ============================================================

/**
 * OrbitStar — interactive bespoke hero centerpiece untuk Grafio.
 *
 * Glowing core orb di tengah dengan pill insight keywords berorbit di
 * cincin konsentris. Auto-rotate halus ketika idle, drag (mouse/touch)
 * untuk spin, momentum/inertia setelah release, kembali ke auto-rotate.
 *
 * IMPLEMENTASI:
 * - Rotation: setiap frame di RAF, set `el.style.transform = rotate(Xdeg)`
 *   DIRECT ke DOM (bukan via CSS variable) → reliable di semua browser.
 * - Pill counter-rotation: tiap pill punya ref, di-update tiap frame jadi
 *   `rotate(-Xdeg)` (inverse parent ring rotation) supaya teks tetap upright.
 * - React tidak re-render per frame.
 */
export default function OrbitStar({
  size = 480,
  labels = DEFAULT_LABELS,
  ringCount = 3,
  baseSpeed = 6,
  theme: themeProp,
  className = "",
}: Props) {
  const theme = { ...DEFAULT_THEME, ...themeProp };
  const reduced = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const ringWrappersRef = useRef<(HTMLDivElement | null)[]>([]);
  // 2D array: pillCounterRefs[ringIdx][labelIdx] = counter-rotation div
  const pillCounterRefs = useRef<(HTMLDivElement | null)[][]>([]);

  // Per-ring rotation state (degrees) and velocity (deg/sec)
  const rotationsRef = useRef<number[]>([]);
  const velocitiesRef = useRef<number[]>([]);

  // Speed multipliers untuk parallax — outer faster, mixed direction
  const ringMultipliers = useMemo(() => {
    const m: number[] = [];
    for (let i = 0; i < ringCount; i++) {
      const dir = i % 2 === 0 ? 1 : -0.75;
      m.push((1 - i * 0.18) * dir);
    }
    return m;
  }, [ringCount]);

  // Initialize rotation refs (mutate during render OK krn refs, bukan state)
  if (rotationsRef.current.length !== ringCount) {
    rotationsRef.current = new Array(ringCount).fill(0).map((_, i) => i * 18);
    velocitiesRef.current = new Array(ringCount).fill(0);
  }

  // Distribute labels across rings
  const rings = useMemo(() => {
    const half = size / 2;
    const radii =
      ringCount === 2 ? [0.85, 0.55] : [0.88, 0.66, 0.42];
    const labelsPerRing = Math.ceil(labels.length / ringCount);

    return Array.from({ length: ringCount }, (_, r) => {
      const ringLabels = labels.slice(r * labelsPerRing, (r + 1) * labelsPerRing);
      return {
        radius: (radii[r] ?? 0.85) * half,
        dashed: r === 1, // middle ring dashed
        labels: ringLabels.map((text, i) => ({
          text,
          angle: (i / Math.max(ringLabels.length, 1)) * 360 + r * 25,
          color: theme.nodes[(r * labelsPerRing + i) % theme.nodes.length],
        })),
      };
    });
  }, [size, labels, ringCount, theme.nodes]);

  // Drag state
  const draggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const lastTimeRef = useRef(0);

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Apply rotations DIRECTLY ke DOM transform — most reliable approach.
  // Tidak pakai CSS variable indirection.
  const applyRotations = useCallback(() => {
    for (let i = 0; i < ringCount; i++) {
      const rot = rotationsRef.current[i] ?? 0;
      const ringEl = ringWrappersRef.current[i];
      if (ringEl) {
        ringEl.style.transform = `rotate(${rot}deg)`;
      }
      // Counter-rotate semua pill di ring ini
      const counters = pillCounterRefs.current[i];
      if (counters) {
        for (const el of counters) {
          if (el) el.style.transform = `rotate(${-rot}deg)`;
        }
      }
    }
  }, [ringCount]);

  // RAF animation loop
  useEffect(() => {
    // Apply initial rotations sekali (untuk reduced motion juga supaya offset awal terlihat)
    applyRotations();

    if (reduced) return;

    let raf = 0;
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000); // cap dt
      lastT = t;

      for (let i = 0; i < ringCount; i++) {
        if (draggingRef.current) continue; // rotation di-set imperatively dari pointer

        if (Math.abs(velocitiesRef.current[i]) > 0.5) {
          // Momentum decay setelah release
          rotationsRef.current[i] += velocitiesRef.current[i] * dt;
          velocitiesRef.current[i] *= 0.93;
        } else {
          velocitiesRef.current[i] = 0;
          // Auto-rotate
          rotationsRef.current[i] += baseSpeed * ringMultipliers[i] * dt;
        }
      }
      applyRotations();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, ringCount, baseSpeed, ringMultipliers, applyRotations]);

  // Compute angle (deg) of pointer relative to container center
  const getAngle = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (
      (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) *
        180) /
      Math.PI
    );
  }, []);

  // Drag handlers — TETAP aktif bahkan saat reduced-motion karena drag adalah
  // interaksi user-initiated, BUKAN animasi dekoratif. Spec a11y hanya minta
  // matikan auto-motion, bukan kontrol user.
  const startDrag = useCallback(
    (x: number, y: number) => {
      draggingRef.current = true;
      lastAngleRef.current = getAngle(x, y);
      lastTimeRef.current = performance.now();
      velocitiesRef.current = velocitiesRef.current.map(() => 0);
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    },
    [getAngle],
  );

  const moveDrag = useCallback(
    (x: number, y: number) => {
      if (!draggingRef.current) return;
      const now = performance.now();
      const a = getAngle(x, y);
      let delta = a - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const dt = Math.max(0.001, (now - lastTimeRef.current) / 1000);

      for (let i = 0; i < ringCount; i++) {
        const ringDelta = delta * ringMultipliers[i];
        rotationsRef.current[i] += ringDelta;
        velocitiesRef.current[i] = ringDelta / dt;
      }
      applyRotations();

      lastAngleRef.current = a;
      lastTimeRef.current = now;
    },
    [getAngle, ringCount, ringMultipliers, applyRotations],
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = "grab";
    }
  }, []);

  // Global pointer listeners — perlu di window untuk catch release di luar
  // component. TIDAK respect reduced motion karena ini interaksi user.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onMouseUp = () => endDrag();
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (draggingRef.current) e.preventDefault(); // cegah page scroll saat drag
      moveDrag(t.clientX, t.clientY);
    };
    const onTouchEnd = () => endDrag();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [moveDrag, endDrag]);

  // ============================================================
  // RENDER
  // ============================================================

  const haloStyle: CSSProperties = {
    background: `radial-gradient(circle, ${theme.core}30 0%, transparent 60%)`,
    filter: "blur(40px)",
    animation: reduced ? "none" : "orbHaloPulse 7s ease-in-out infinite",
  };

  const corePulseStyle: CSSProperties = {
    animation: reduced ? "none" : "orbCorePulse 4.5s ease-in-out infinite",
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{
        width: size,
        height: size,
        touchAction: "none",
        cursor: "grab",
      }}
      onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) startDrag(t.clientX, t.clientY);
      }}
      role="img"
      aria-label="Visualisasi orbital data interaktif. Geser untuk memutar."
    >
      {/* Outer halo fog */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={haloStyle}
      />

      {/* Per-ring wrappers — ring circle SVG + pill nodes orbiting */}
      {rings.map((ring, ri) => {
        // Init nested pill counter array
        if (!pillCounterRefs.current[ri]) {
          pillCounterRefs.current[ri] = [];
        }
        return (
          <div
            key={ri}
            ref={(el) => {
              ringWrappersRef.current[ri] = el;
            }}
            className="absolute inset-0"
            style={{
              transformOrigin: "center",
              willChange: "transform",
            }}
          >
            {/* Ring circle */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              className="absolute inset-0 pointer-events-none"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={ring.radius}
                fill="none"
                stroke={theme.ring}
                strokeWidth={1}
                strokeDasharray={ring.dashed ? "3 6" : undefined}
              />
            </svg>

            {/* Pill nodes */}
            {ring.labels.map((label, li) => {
              const key = `${ri}-${li}`;
              const angleRad = (label.angle * Math.PI) / 180;
              const x = size / 2 + ring.radius * Math.cos(angleRad);
              const y = size / 2 + ring.radius * Math.sin(angleRad);
              const isHovered = hoveredKey === key;

              return (
                <div
                  key={key}
                  className="absolute"
                  style={{
                    left: x,
                    top: y,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "auto",
                  }}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() =>
                    setHoveredKey((k) => (k === key ? null : k))
                  }
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setHoveredKey(key);
                    setTimeout(
                      () => setHoveredKey((k) => (k === key ? null : k)),
                      1500,
                    );
                  }}
                >
                  {/* Counter-rotate so pill content tetap upright. Ref disimpan
                      di pillCounterRefs supaya RAF bisa set transform inverse. */}
                  <div
                    ref={(el) => {
                      pillCounterRefs.current[ri][li] = el;
                    }}
                    style={{ transformOrigin: "center" }}
                  >
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border whitespace-nowrap"
                      style={{
                        background: isHovered
                          ? `${label.color}22`
                          : "rgba(15,26,63,0.7)",
                        borderColor: isHovered
                          ? label.color
                          : "rgba(255,255,255,0.08)",
                        color: isHovered ? "#fff" : "rgba(241,245,255,0.85)",
                        fontSize: "10px",
                        fontFamily: "var(--font-syne, sans-serif)",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        transform: isHovered ? "scale(1.18)" : "scale(1)",
                        boxShadow: isHovered
                          ? `0 0 22px ${label.color}66`
                          : "0 2px 8px rgba(0,0,0,0.3)",
                        transition:
                          "transform 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s, border-color 0.3s, color 0.3s, box-shadow 0.3s",
                      }}
                    >
                      <span
                        className="rounded-full flex-shrink-0"
                        style={{
                          width: 6,
                          height: 6,
                          background: label.color,
                          boxShadow: `0 0 6px ${label.color}`,
                        }}
                      />
                      {label.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Center orb — NO rotation, gentle pulse only */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={corePulseStyle}
      >
        <svg
          viewBox="0 0 200 200"
          width={size * 0.32}
          height={size * 0.32}
        >
          <defs>
            <radialGradient
              id={`orbStarCore-${size}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor={theme.core} stopOpacity="0.9" />
              <stop offset="75%" stopColor={theme.core} stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
            <radialGradient
              id={`orbStarHighlight-${size}`}
              cx="38%"
              cy="32%"
              r="38%"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="80"
            fill={`url(#orbStarCore-${size})`}
            style={{ filter: `drop-shadow(0 0 35px ${theme.core}99)` }}
          />
          <ellipse
            cx="85"
            cy="78"
            rx="22"
            ry="12"
            fill={`url(#orbStarHighlight-${size})`}
          />
          {/* 6-pointed starburst */}
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
          <circle cx="100" cy="100" r="3.5" fill="#fff" opacity="0.95" />
        </svg>
      </div>

      {/* Inline keyframes — scoped via styled-jsx */}
      <style jsx>{`
        @keyframes orbHaloPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        @keyframes orbCorePulse {
          0%,
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.04);
            filter: brightness(1.12);
          }
        }
      `}</style>
    </div>
  );
}
