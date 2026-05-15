"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Apakah data saya aman?",
    a: "Ya, semua data dienkripsi dan tidak kami simpan setelah proses selesai.",
  },
  {
    q: "Bisa cancel kapan saja?",
    a: "Tentu, kamu bisa cancel langsung dari dashboard tanpa biaya tambahan.",
  },
  {
    q: "Format file apa saja yang didukung?",
    a: "CSV, XLS, dan XLSX dengan ukuran maksimal 10MB.",
  },
  {
    q: "Apakah ada free trial untuk Pro?",
    a: "Ya, 7 hari gratis untuk paket Pro. Tidak perlu kartu kredit.",
  },
  {
    q: "Bagaimana cara upgrade plan?",
    a: "Klik tombol upgrade di dashboard dan ikuti instruksi pembayaran.",
  },
];

export default function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="max-w-3xl mx-auto mt-12">
      <h3 className="font-bold text-white text-xl mb-6">Frequently Asked</h3>
      {faqs.map((f, i) => (
        <div key={i} className="border-b border-borderColor mb-4 pb-4">
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between text-left text-white"
          >
            <span className="text-sm md:text-base">{f.q}</span>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${openIdx === i ? "rotate-180" : ""}`}
            />
          </button>
          {openIdx === i && <p className="text-sm text-muted mt-2">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}