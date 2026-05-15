"use client";
import { Doughnut } from "react-chartjs-2";
import { ensureRegistered, PALETTE_ARR, rgba } from "./registry";

ensureRegistered();

type Props = {
  labels: string[];
  data: number[];
  height?: number;
  cutout?: string | number;
  centerLabel?: string;
};

export default function DoughnutChart({
  labels,
  data,
  height = 320,
  cutout = "70%",
  centerLabel,
}: Props) {
  const colors = labels.map((_, i) => PALETTE_ARR[i % PALETTE_ARR.length]);
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.map((c) => rgba(c, 0.85)),
        borderColor: "#05081A",
        borderWidth: 3,
        hoverOffset: 12,
      },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: "#E2E8F0", padding: 14, usePointStyle: true, pointStyle: "circle" },
      },
      tooltip: {
        backgroundColor: "rgba(10,18,48,0.95)",
        borderColor: "rgba(0,212,255,0.35)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
  };
  return (
    <div className="relative" style={{ height }}>
      <Doughnut data={chartData} options={options} />
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-8">
          <span className="text-xs text-muted uppercase tracking-widest">Total</span>
          <span className="text-2xl font-syne font-bold text-white">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
