"use client";
import { motion, useInView, type Variants } from "framer-motion";
import { useRef, ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span" | "article";
  once?: boolean;
  amount?: number;
};

/**
 * Scroll-triggered fadeUp. Stagger via parent <Stagger>, atau standalone
 * dengan delay manual. Hormati prefers-reduced-motion (langsung visible).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 16,
  duration = 0.6,
  className = "",
  as = "div",
  once = true,
  amount = 0.15,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduced = useReducedMotion();
  const Comp: any = motion[as as keyof typeof motion];

  const variants: Variants = {
    hidden: { opacity: 0, y },
    visible: { opacity: 1, y: 0 },
  };

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Comp
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}
