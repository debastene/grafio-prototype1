"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Sparkline from "./Sparkline";

type Props = {
  label: string;
  value: string;
  change: number;
  spark: number[];
  color?: string;
};

export default function KpiCard({ label, value, change, spark, color = "#00D4FF" }: Props) {
  const positive = change >= 0;
  return (
    <div className="glass rounded-xl p-5 hover:border-cyan/40 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-syne font-bold text-white mt-1">{value}</p>
        </div>
        <span
          className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded ${
            positive ? "text-mint bg-mint/10" : "text-danger bg-danger/10"
          }`}
        >
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 -mx-1 opacity-90 group-hover:opacity-100 transition-opacity">
        <Sparkline data={spark} color={color} height={40} />
      </div>
    </div>
  );
}
