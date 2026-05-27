"use client";
import { motion, useInView } from "framer-motion";
import { ReactNode, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
  as?: "div" | "ul" | "section" | "ol";
  amount?: number;
};

/**
 * Container yang membuat semua <StaggerItem> langsung child-nya muncul
 * berurutan. Gunakan untuk grid/list reveal. Gap = jeda antar item (s).
 */
export function Stagger({
  children,
  className = "",
  delay = 0,
  gap = 0.08,
  as = "div",
  amount = 0.15,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduced = useReducedMotion();
  const Comp: any = motion[as as keyof typeof motion];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Comp
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: gap, delayChildren: delay },
        },
      }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className = "",
  y = 18,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  as?: "div" | "li" | "article" | "section";
}) {
  const reduced = useReducedMotion();
  const Comp: any = motion[as as keyof typeof motion];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Comp
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </Comp>
  );
}
