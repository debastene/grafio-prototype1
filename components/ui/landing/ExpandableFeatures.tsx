"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useReducedMotion } from "../motion/useReducedMotion";

type FeatureAccent = "cyan" | "violet" | "mint" | "coral" | "warning" | "purple";

type Feature = {
  icon: any;
  title: string;
  desc: string;
  accent: FeatureAccent;
};

type Props = { features: Feature[] };

const ACCENT_STYLES: Record<FeatureAccent, { bg: string; ring: string; icon: string; ringActive: string }> = {
  cyan:    { bg: "bg-cyan/10",    ring: "border-cyan/25",    icon: "text-cyan",       ringActive: "border-cyan/55" },
  violet:  { bg: "bg-violet/12",  ring: "border-violet/25",  icon: "text-violetSoft", ringActive: "border-violet/55" },
  mint:    { bg: "bg-mint/10",    ring: "border-mint/25",    icon: "text-mint",       ringActive: "border-mint/55" },
  coral:   { bg: "bg-coral/12",   ring: "border-coral/25",   icon: "text-coral",      ringActive: "border-coral/55" },
  warning: { bg: "bg-warning/10", ring: "border-warning/25", icon: "text-warning",    ringActive: "border-warning/55" },
  purple:  { bg: "bg-purple/12",  ring: "border-purple/25",  icon: "text-purple",     ringActive: "border-purple/55" },
};

/**
 * Expandable feature pills/cards — klik untuk expand penjelasan panjang.
 * Default: card kompak menampilkan icon + title + 1 baris teaser. Saat
 * dibuka, expand jadi panel dengan deskripsi lengkap.
 *
 * Salah satu card default terbuka (idx 0) supaya user paham polanya.
 */
export default function ExpandableFeatures({ features }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {features.map((f, i) => {
        const a = ACCENT_STYLES[f.accent];
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            className={`group glass rounded-2xl transition-all duration-400 ease-glide ${
              isOpen ? `${a.ringActive} border` : `${a.ring} border hover:${a.ringActive}`
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full p-5 text-left flex items-center gap-4"
              aria-expanded={isOpen}
            >
              <div
                className={`w-11 h-11 rounded-xl ${a.bg} border ${a.ring} flex items-center justify-center flex-shrink-0 transition-all duration-400 ease-glide ${
                  isOpen ? "scale-110" : "group-hover:scale-105"
                }`}
              >
                <f.icon className={`w-5 h-5 ${a.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-syne font-semibold text-white text-base leading-snug">
                  {f.title}
                </h3>
              </div>
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full border ${a.ring} flex items-center justify-center transition-transform duration-400 ease-glide ${
                  isOpen ? "rotate-45 bg-cyan/10" : ""
                }`}
              >
                <Plus className={`w-3.5 h-3.5 ${a.icon}`} />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="panel"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 pl-[4.75rem] text-sm text-muted leading-relaxed">
                    {f.desc}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
