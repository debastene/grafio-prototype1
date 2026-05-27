"use client";
import { useEffect, ReactNode } from "react";
import Lenis from "lenis";

/**
 * Lenis smooth-scroll global. Disabled total saat prefers-reduced-motion
 * (langsung pakai native scroll). Tidak menyentuh logika navigasi atau
 * hash anchor — Lenis hanya intercept wheel/touch untuk easing.
 */
export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    const onFrame = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
