"use client";
import { ReactNode, useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
};

/**
 * Subtle 3D tilt mengikuti cursor — maks ±4° default. Glare opsional
 * (radial highlight yang ngikut cursor) — extra "mahal" tapi heavier.
 *
 * Catatan rules of hooks: SEMUA hook dipanggil di top level, sebelum
 * early return apa pun. Kalau reduced motion, render fallback statis.
 */
export default function TiltCard({
  children,
  className = "",
  max = 4,
  glare = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);

  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [max, -max]), {
    stiffness: 200,
    damping: 20,
  });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-max, max]), {
    stiffness: 200,
    damping: 20,
  });

  // Glare bg via useMotionTemplate (single hook, stable across renders).
  const glareBg = useMotionTemplate`radial-gradient(circle 220px at ${mx}% ${my}%, rgba(0,212,255,0.18), transparent 60%)`;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const relX = (e.clientX - r.left) / r.width - 0.5;
    const relY = (e.clientY - r.top) / r.height - 0.5;
    x.set(relX);
    y.set(relY);
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      className={`relative ${className}`}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: glareBg, mixBlendMode: "screen" }}
        />
      )}
    </motion.div>
  );
}
