import type { ReactNode } from "react";

/**
 * Fade-up untuk konten ABOVE THE FOLD — murni CSS (tanpa JS).
 *
 * <Reveal> memakai framer-motion + IntersectionObserver: HTML dari server
 * dirender opacity:0 dan baru terlihat setelah seluruh bundle (termasuk
 * three.js) ter-hydrate. Untuk hero itu membuat LCP menunggu JS. Animasi CSS
 * mulai di paint pertama, dan dimatikan saat prefers-reduced-motion.
 */
export default function HeroReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-fadeUp motion-reduce:animate-none ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
