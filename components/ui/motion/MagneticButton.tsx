"use client";
import { ReactNode, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "div" | "span";
};

/**
 * Magnetic wrapper — child element (button/link) akan terdorong ~6-10px
 * mengikuti cursor saat hover. Cocok untuk CTA. Jangan dipakai untuk
 * elemen kecil yang banyak (overload).
 *
 * Penting: ini WRAPPER. Anak harus sudah punya semua handler sendiri
 * (onClick, href via Link, dst). Magnetic tidak mengubah perilaku.
 */
export default function MagneticButton({
  children,
  className = "",
  strength = 0.25,
  as = "div",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reduced = useReducedMotion();

  const springX = useSpring(x, { stiffness: 180, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 180, damping: 18, mass: 0.4 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    x.set(relX * strength);
    y.set(relY * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Comp: any = as === "span" ? motion.span : motion.div;

  return (
    <Comp
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduced ? undefined : { x: springX, y: springY }}
      className={`inline-block ${className}`}
    >
      {children}
    </Comp>
  );
}
