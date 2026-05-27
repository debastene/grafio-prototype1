"use client";
import { useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitTerm, OrbitAccent } from "./orbitTerms";

// ============================================================
// CONSTANTS
// ============================================================

const ACCENT_HEX: Record<OrbitAccent, string> = {
  cyan: "#7DE3FF",
  violet: "#A78BFA",
  mint: "#00FFB3",
};

// 3 ring axes — globe-style, bukan flat concentric.
// Each tuple: [eulerX, eulerY, eulerZ] rotation in radians.
const RING_ORIENTATIONS: [number, number, number][] = [
  [0, 0, 0], // equator
  [Math.PI / 2.5, 0, Math.PI / 6], // tilted forward + slight yaw
  [-Math.PI / 4, Math.PI / 3, 0], // tilted back + yaw
];

// Radii dipilih supaya label pill (~50-60px wide HTML overlay) muat
// dalam canvas + buffer 50-80px ke edge. Sebelumnya max 2.3 terlalu
// besar → labels keluar canvas & ke-clip oleh section overflow-hidden.
const RING_RADII = [1.35, 1.1, 1.55];

const CAMERA_Z = 6;

// ============================================================
// CENTER STARBURST — premium SVG via Html overlay
// ============================================================

/**
 * StarCore — glowing centerpiece di world origin.
 *
 * IMPLEMENTASI: pakai drei <Html center> untuk mount SVG starburst
 * persis di koordinat (0,0,0). Pendekatan ini memberi kontrol gradient
 * & filter penuh (radial gradients berlapis, specular highlight, drop-
 * shadow glow, smooth pulse animation) yang sulit dicapai dengan
 * Three.js material primitives saja. Visual = premium "luxury orb",
 * bukan flat construction-line sketch.
 *
 * Point light Three.js tetap ada untuk ambient cyan glow yang mengenai
 * orbit rings — memberi kesan "core bercahaya menerangi seluruh globe".
 */
function StarCore() {
  return (
    <>
      {/* Ambient cyan light dari core ke rings */}
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#00D4FF" distance={4} />

      {/* SVG starburst mounted di world origin */}
      <Html
        center
        position={[0, 0, 0]}
        zIndexRange={[1, 0]}
        style={{ pointerEvents: "none" }}
      >
        <PremiumStarburst />
      </Html>
    </>
  );
}

/**
 * Premium SVG starburst — gradient layers + specular + glow filter.
 *
 * Layer dari belakang ke depan:
 * 1. Outer halo (radial cyan→violet, large, soft)
 * 2. 12 ray (4 major + 8 minor) dengan linear gradient tapered
 * 3. Crystal halo medium (radial bright cyan)
 * 4. Inner core bright (radial white→cyan)
 * 5. Specular highlight (off-center ellipse, kesan glass curvature)
 * 6. 6-ray inner accent (brightest white)
 * 7. Center dot pinpoint
 *
 * Gentle breathing pulse + drop-shadow cyan untuk glow yang "spill out".
 */
function PremiumStarburst() {
  return (
    <div
      aria-hidden
      style={{
        width: 240,
        height: 240,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes grafio-star-pulse {
          0%, 100% { transform: scale(1); opacity: 0.96; }
          50%      { transform: scale(1.06); opacity: 1; }
        }
        @keyframes grafio-star-rotate-slow {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Layer 1: outermost soft fog (DOES NOT pulse — stable ambient) */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          background:
            "radial-gradient(circle, rgba(0,212,255,0.28) 0%, rgba(139,92,246,0.15) 35%, transparent 65%)",
          filter: "blur(20px)",
        }}
      />

      {/* Layer 2: 12 rotating outer rays (slow spin) */}
      <svg
        viewBox="0 0 240 240"
        width="240"
        height="240"
        style={{
          position: "absolute",
          inset: 0,
          animation: "grafio-star-rotate-slow 60s linear infinite",
        }}
      >
        <defs>
          <linearGradient id="grafio-ray-major" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#7DE3FF" stopOpacity="0" />
            <stop offset="55%" stopColor="#00D4FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="grafio-ray-minor" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0" />
            <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#7DE3FF" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * 360;
          const isMajor = i % 3 === 0;
          return (
            <line
              key={i}
              x1="120"
              y1="120"
              x2="120"
              y2={isMajor ? 30 : 50}
              stroke={isMajor ? "url(#grafio-ray-major)" : "url(#grafio-ray-minor)"}
              strokeWidth={isMajor ? 2.5 : 1.5}
              strokeLinecap="round"
              transform={`rotate(${angle} 120 120)`}
              opacity={isMajor ? 0.95 : 0.5}
            />
          );
        })}
      </svg>

      {/* Layer 3-7: core orb (pulses gentle, drop-shadow glow) */}
      <svg
        viewBox="0 0 240 240"
        width="240"
        height="240"
        style={{
          position: "absolute",
          inset: 0,
          animation: "grafio-star-pulse 4.5s ease-in-out infinite",
          filter: "drop-shadow(0 0 28px rgba(0, 212, 255, 0.65)) drop-shadow(0 0 8px rgba(255,255,255,0.4))",
        }}
      >
        <defs>
          <radialGradient id="grafio-core-orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="32%" stopColor="#7DE3FF" stopOpacity="0.95" />
            <stop offset="62%" stopColor="#00D4FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="grafio-core-inner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%" stopColor="#7DE3FF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.2" />
          </radialGradient>
          <radialGradient id="grafio-core-highlight" cx="38%" cy="32%" r="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Crystal halo medium */}
        <circle cx="120" cy="120" r="46" fill="url(#grafio-core-orb)" />

        {/* Inner bright core */}
        <circle cx="120" cy="120" r="28" fill="url(#grafio-core-inner)" />

        {/* Specular highlight (kesan dimensional, light dari top-left) */}
        <ellipse cx="106" cy="100" rx="16" ry="9" fill="url(#grafio-core-highlight)" />

        {/* 6-ray inner accent (brightest) */}
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={i}
            x1="120"
            y1="120"
            x2="120"
            y2="78"
            stroke="rgba(255,255,255,0.96)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${(i / 6) * 360} 120 120)`}
          />
        ))}

        {/* Center pinpoint */}
        <circle cx="120" cy="120" r="3.5" fill="#ffffff" />
      </svg>
    </div>
  );
}

// ============================================================
// ORBIT RING + LABELS
// ============================================================

/**
 * Single orbit ring: cincin glow tipis + label-label menempel pada angle
 * masing-masing. Ring sebagai group, jadi rotasi orientasi diterapkan
 * sekali untuk seluruh ring + labels (sumbu globe-style).
 */
function OrbitRing({
  radius,
  rotation,
  terms,
  activeId,
  onClick,
  isAnyActive,
  dashed = false,
}: {
  radius: number;
  rotation: [number, number, number];
  terms: OrbitTerm[];
  activeId: string | null;
  onClick: (id: string) => void;
  isAnyActive: boolean;
  dashed?: boolean;
}) {
  // Ring circle geometry (torus tipis untuk visibility di 3D)
  const ringGeom = useMemo(
    () => new THREE.TorusGeometry(radius, 0.005, 4, 96),
    [radius],
  );

  return (
    <group rotation={rotation}>
      {/* Ring stroke */}
      <mesh geometry={ringGeom}>
        <meshBasicMaterial
          color="#00D4FF"
          transparent
          opacity={dashed ? 0.18 : 0.28}
        />
      </mesh>

      {/* Dashed accent: tambah segments terpisah untuk efek garis putus */}
      {dashed && (
        <DashedRing radius={radius} segments={48} />
      )}

      {/* Labels pada ring ini */}
      {terms.map((term, i) => {
        const angle = (i / terms.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <OrbitLabel
            key={term.id}
            position={[x, y, 0]}
            term={term}
            active={activeId === term.id}
            dimmed={isAnyActive && activeId !== term.id}
            onClick={() => onClick(term.id)}
          />
        );
      })}
    </group>
  );
}

/** Dashed ring helper — pakai short arc segments biar terlihat putus-putus. */
function DashedRing({ radius, segments }: { radius: number; segments: number }) {
  const geom = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) continue; // skip every other segment
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 0.6) / segments) * Math.PI * 2;
      const x1 = Math.cos(a1) * radius;
      const y1 = Math.sin(a1) * radius;
      const x2 = Math.cos(a2) * radius;
      const y2 = Math.sin(a2) * radius;
      pts.push(x1, y1, 0, x2, y2, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pts), 3),
    );
    return g;
  }, [radius, segments]);

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#A78BFA" transparent opacity={0.4} />
    </lineSegments>
  );
}

/**
 * Single orbit label — HTML pill div embedded di 3D space.
 * Depth opacity: dim ketika di belakang scene origin (z-camera negative).
 */
function OrbitLabel({
  position,
  term,
  active,
  dimmed,
  onClick,
}: {
  position: [number, number, number];
  term: OrbitTerm;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const accentHex = ACCENT_HEX[term.accent];

  // Update opacity tiap frame berdasarkan z world position relatif ke camera
  // (label di belakang globe = redup). Tidak set state → no React re-render.
  useFrame(({ camera }) => {
    if (!groupRef.current || !wrapperRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toLabel = worldPos.clone().sub(camera.position);
    const dot = toLabel.dot(camDir);
    // dot > 0 = label di depan camera (visible)
    // Normalize to opacity: depth -1..1 → opacity 0.25..1
    const dist = toLabel.length();
    const normalized = dot / dist; // -1..1 (front..back relative to camera direction)
    const opacity = Math.max(0.25, 0.55 + normalized * 0.45);
    const scale = 0.7 + normalized * 0.3;
    wrapperRef.current.style.opacity = String(
      dimmed ? opacity * 0.4 : opacity,
    );
    wrapperRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
  });

  return (
    <group ref={groupRef} position={position}>
      <Html
        center
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "auto" }}
      >
        <div
          ref={wrapperRef}
          style={{
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
            transition: "filter 0.3s ease",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }}
            aria-label={`Lihat penjelasan ${term.label}`}
            className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bgDeep rounded-full"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 11px",
              borderRadius: 999,
              border: `1px solid ${active ? accentHex : "rgba(255,255,255,0.08)"}`,
              background: active ? `${accentHex}22` : "rgba(15,26,63,0.72)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color: active ? "#fff" : "rgba(241,245,255,0.88)",
              fontSize: 10,
              fontFamily: "var(--font-syne, sans-serif)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
              boxShadow: active
                ? `0 0 22px ${accentHex}66`
                : "0 2px 8px rgba(0,0,0,0.3)",
              transition:
                "background 0.3s, border-color 0.3s, color 0.3s, box-shadow 0.3s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.transform = "scale(1.08)";
              el.style.background = `${accentHex}33`;
              el.style.borderColor = accentHex;
              el.style.color = "#fff";
              el.style.boxShadow = `0 0 24px ${accentHex}88`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.transform = "scale(1)";
              if (!active) {
                el.style.background = "rgba(15,26,63,0.72)";
                el.style.borderColor = "rgba(255,255,255,0.08)";
                el.style.color = "rgba(241,245,255,0.88)";
                el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
              }
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: accentHex,
                boxShadow: `0 0 6px ${accentHex}`,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {term.label}
          </button>
        </div>
      </Html>
    </group>
  );
}

// ============================================================
// SCENE — combines core + rings + controls
// ============================================================

function Scene({
  terms,
  activeId,
  onLabelClick,
  autoRotate,
  baseSpeed,
}: {
  terms: OrbitTerm[];
  activeId: string | null;
  onLabelClick: (id: string) => void;
  autoRotate: boolean;
  baseSpeed: number;
}) {
  const { gl } = useThree();

  // Distribute terms across rings
  const ringTerms = useMemo(() => {
    const perRing = Math.ceil(terms.length / 3);
    return [
      terms.slice(0, perRing),
      terms.slice(perRing, perRing * 2),
      terms.slice(perRing * 2),
    ];
  }, [terms]);

  // Dispose WebGL context properly on unmount
  useEffect(() => {
    return () => {
      gl.dispose();
    };
  }, [gl]);

  const isAnyActive = activeId !== null;

  return (
    <>
      <ambientLight intensity={0.5} />

      <StarCore />

      {RING_ORIENTATIONS.map((rot, i) => (
        <OrbitRing
          key={i}
          radius={RING_RADII[i]}
          rotation={rot}
          terms={ringTerms[i] ?? []}
          activeId={activeId}
          onClick={onLabelClick}
          isAnyActive={isAnyActive}
          dashed={i === 1}
        />
      ))}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={baseSpeed}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
      />
    </>
  );
}

// ============================================================
// EXPORTED CANVAS WRAPPER
// ============================================================

type Props = {
  terms: OrbitTerm[];
  activeId: string | null;
  onLabelClick: (id: string) => void;
  baseSpeed?: number;
  className?: string;
};

/**
 * OrbitScene3D — Canvas wrapper. Tidak include info panel.
 * Panel di-render terpisah di parent OrbitStar.tsx supaya layout
 * desktop (canvas slide left + panel right) vs mobile (stack) bisa
 * dikontrol di level layout.
 */
export default function OrbitScene3D({
  terms,
  activeId,
  onLabelClick,
  baseSpeed = 0.6,
  className = "",
}: Props) {
  // Auto-rotate dimatikan saat ada label aktif — fokus ke konten
  const autoRotate = activeId === null;

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent", touchAction: "none" }}
      >
        <Suspense fallback={null}>
          <Scene
            terms={terms}
            activeId={activeId}
            onLabelClick={onLabelClick}
            autoRotate={autoRotate}
            baseSpeed={baseSpeed}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
