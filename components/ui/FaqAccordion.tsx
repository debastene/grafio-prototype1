"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "./motion/useReducedMotion";

const faqs = [
  {
    q: "Apakah data saya aman?",
    a: "File kamu diproses di browser dan tidak diupload ke server kami. Untuk narasi AI (saat login), yang dikirim hanya nama kolom, statistik ringkas, dan maks 5 baris sampel yang data pribadinya (nama, email, no HP, NIK, alamat) sudah disamarkan otomatis. Data baru tersimpan di cloud kalau kamu klik Save Project (ringkasan + maks 100 baris).",
  },
  {
    q: "Bisa cancel kapan saja?",
    a: "Tentu, kamu bisa cancel langsung dari dashboard tanpa biaya tambahan. Refund prorata untuk paket tahunan dalam 30 hari pertama.",
  },
  {
    q: "Format file apa saja yang didukung?",
    a: "CSV, TSV, TXT (berpemisah), JSON, dan JSONL — maks 5 MB per file. Excel/Parquet belum didukung langsung: ekspor dulu ke CSV (Excel: File → Save As → CSV).",
  },
  {
    q: "Apakah ada free trial untuk Pro?",
    a: "Ya, 7 hari gratis untuk paket Student/Pro. Tidak perlu kartu kredit. Akses semua fitur premium selama trial.",
  },
  {
    q: "Bagaimana cara upgrade plan?",
    a: "Saat ini semua plan masih gratis untuk early users. Sistem billing (Stripe + Midtrans) sedang disiapkan dan akan aktif segera.",
  },
];

export default function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="max-w-3xl mx-auto mt-16">
      <h3 className="font-syne font-bold text-white text-2xl md:text-3xl mb-8 text-center">
        Frequently Asked
      </h3>
      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              className={`rounded-xl border transition-all duration-400 ease-glide overflow-hidden ${
                isOpen
                  ? "border-cyan/40 bg-bgSurface/80 backdrop-blur-sm"
                  : "border-borderColor bg-bgSurface/40 hover:border-cyan/25"
              }`}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center justify-between text-left text-white px-5 py-4 gap-4"
                aria-expanded={isOpen}
              >
                <span className="text-sm md:text-base font-medium">{f.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-cyan flex-shrink-0 transition-transform duration-400 ease-glide ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
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
                    <p className="text-sm text-muted px-5 pb-4 leading-relaxed">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
