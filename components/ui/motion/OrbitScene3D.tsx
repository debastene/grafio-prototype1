"use client";
import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Billboard } from "@react-three/drei";
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

const RING_RADII = [2.0, 1.7, 2.3];

// ============================================================
// CENTER STARBURST
// ============================================================

/**
 * Glowing core orb dengan 6-ray starburst (3D mesh + emissive material).
 * Tetap di pusat, pulse breathing halus. Tidak ikut auto-rotate orbit.
 */
function StarCore({ pulse = true }: { pulse?: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulse) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.3) * 0.04;
    if (coreRef.current) coreRef.current.scale.setScalar(s);
    if (haloRef.current) haloRef.current.scale.setScalar(s * 1.1);
  });

  return (
    <group>
      {/* Outer halo glow (sprite-like billboard sphere) */}
      <Billboard>
        <mesh ref={haloRef}>
          <circleGeometry args={[0.55, 32]} />
          <meshBasicMaterial color="#00D4FF" transparent opacity={0.18} />
        </mesh>
      </Billboard>

      {/* Mid glow */}
      <Billboard>
        <mesh>
          <circleGeometry args={[0.32, 32]} />
          <meshBasicMaterial color="#7DE3FF" transparent opacity={0.32} />
        </mesh>
      </Billboard>

      {/* Solid core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* 12-ray starburst as line segments (motif Grafio compass) */}
      <Starburst rays={12} length={0.42} />
      {/* Inner 6-ray brighter accent */}
      <Starburst rays={6} length={0.28} color="#ffffff" linewidth={2} />

      {/* Cyan point light for ambient glow on rings */}
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#00D4FF" distance={4} />
    </group>
  );
}

/**
 * Helper: emanating rays dari pusat ke ray endpoints.
 * Always face camera via Billboard supaya konsisten dari semua angle.
 */
function Starburst({
  rays,
  length,
  color = "#00D4FF",
  linewidth = 1,
}: {
  rays: number;
  length: number;
  color?: string;
  linewidth?: number;
}) {
  const points = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      // line from center to endpoint
      pts.push(0, 0, 0);
      pts.push(Math.cos(angle) * length, Math.sin(angle) * length, 0);
    }
    return new Float32Array(pts);
  }, [rays, length]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return g;
  }, [points]);

  return (
    <Billboard>
      <lineSegments geometry={geom}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.95}
          linewidth={linewidth}
        />
      </lineSegments>
    </Billboard>
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

      <StarCore pulse />

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
        camera={{ position: [0, 0, 5.5], fov: 50 }}
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
