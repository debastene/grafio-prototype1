"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Sparkline from "./Sparkline";

type Props = {
  label: string;
  value: string;
  /** null = tidak ada tren signifikan → badge naik/turun tidak ditampilkan. */
  change: number | null;
  spark: number[];
  color?: string;
};

export default function KpiCard({ label, value, change, spark, color = "#00D4FF" }: Props) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="glass rounded-xl p-5 hover:border-cyan/40 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-syne font-bold text-white mt-1">{value}</p>
        </div>
        {change !== null && (
          <span
            title="Perubahan menurut garis tren (signifikan, α = 5%)"
            className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded ${
              positive ? "text-mint bg-mint/10" : "text-danger bg-danger/10"
            }`}
          >
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      {spark.length >= 2 ? (
        <div className="mt-3 -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <Sparkline data={spark} color={color} height={40} />
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-muted/70">Tanpa dimensi waktu — tidak ada tren.</p>
      )}
    </div>
  );
}
