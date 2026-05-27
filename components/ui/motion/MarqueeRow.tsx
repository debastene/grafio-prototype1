"use client";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  speed?: number;
  className?: string;
  pauseOnHover?: boolean;
};

/**
 * Marquee row dengan hover-pause. CSS marquee animation didefinisikan
 * di globals.css (.marquee). Komponen ini hanya menambah duration override
 * + pause-on-hover affordance.
 */
export default function MarqueeRow({
  children,
  speed = 30,
  className = "",
  pauseOnHover = true,
}: Props) {
  return (
    <div className={`overflow-hidden relative ${className}`}>
      <div
        className={`marquee gap-12 ${pauseOnHover ? "hover:[animation-play-state:paused]" : ""}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
    </div>
  );
}
