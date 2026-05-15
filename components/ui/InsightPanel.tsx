"use client";
import { Sparkles, TrendingUp, AlertTriangle, Target, Lightbulb } from "lucide-react";

const ICONS = { trend: TrendingUp, anomaly: AlertTriangle, target: Target, idea: Lightbulb };

type Insight = {
  type: keyof typeof ICONS;
  title: string;
  body: string;
};

const DEFAULT_INSIGHTS: Insight[] = [
  {
    type: "trend",
    title: "Pertumbuhan Konsisten",
    body: "Penjualan tumbuh rata-rata 8.4% / bulan. Momentum kuat di Q2 dengan puncak di April (Rp 61.500).",
  },
  {
    type: "anomaly",
    title: "Anomali Terdeteksi di Maret",
    body: "Penjualan Maret turun 25% dari trend, kemungkinan karena drop di kanal Marketplace. Investigasi disarankan.",
  },
  {
    type: "target",
    title: "Target April Tercapai +23%",
    body: "Penjualan April melampaui target sebesar Rp 11.500. Profit margin tertinggi dalam 6 bulan.",
  },
  {
    type: "idea",
    title: "Rekomendasi Aksi",
    body: "Alokasikan ulang budget marketing dari kanal C ke A — ROAS A 3.4× vs C 0.9×.",
  },
];

export default function InsightPanel({ insights = DEFAULT_INSIGHTS }: { insights?: Insight[] }) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-cyan" />
        </div>
        <h3 className="font-syne font-bold text-white">AI Insights</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-mint bg-mint/10 px-2 py-0.5 rounded-full border border-mint/30">
          Auto-generated
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const Icon = ICONS[ins.type];
          const color =
            ins.type === "trend"
              ? "text-cyan"
              : ins.type === "anomaly"
                ? "text-warning"
                : ins.type === "target"
                  ? "text-mint"
                  : "text-purple";
          return (
            <div
              key={i}
              className="rounded-lg border border-borderColor bg-bgSurface/60 p-4 hover:border-cyan/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="font-semibold text-white text-sm">{ins.title}</p>
              </div>
              <p className="text-xs text-muted leading-relaxed">{ins.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
