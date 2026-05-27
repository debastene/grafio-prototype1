"use client";
import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (n: number) => string;
};

/**
 * Number count-up saat masuk viewport. Easing-out via framer spring.
 * Tidak menggunakan IntersectionObserver native — pakai useInView dari
 * framer-motion biar konsisten dengan komponen reveal lain.
 */
export default function CountUp({
  to,
  from = 0,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  formatter,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const mv = useMotionValue(from);
  const spring = useSpring(mv, {
    stiffness: 60,
    damping: 18,
    duration: duration * 1000,
  });
  const [display, setDisplay] = useState<number>(reduced ? to : from);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(to);
      return;
    }
    mv.set(to);
  }, [inView, to, mv, reduced]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [spring]);

  const fmt = formatter ?? ((n: number) => n.toFixed(decimals));

  return (
    <span ref={ref} className={className}>
      {prefix}
      {fmt(display)}
      {suffix}
    </span>
  );
}
