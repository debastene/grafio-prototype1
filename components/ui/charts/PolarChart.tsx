"use client";
import { PolarArea } from "react-chartjs-2";
import { ensureRegistered, PALETTE_ARR, rgba } from "./registry";

ensureRegistered();

type Props = { labels: string[]; data: number[]; height?: number };

export default function PolarChart({ labels, data, height = 320 }: Props) {
  const colors = labels.map((_, i) => PALETTE_ARR[i % PALETTE_ARR.length]);
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.map((c) => rgba(c, 0.7)),
        borderColor: colors,
        borderWidth: 1.5,
      },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: "rgba(255,255,255,0.06)" },
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#7A88AC", backdropColor: "transparent" },
        pointLabels: { color: "#E2E8F0" },
      },
    },
    plugins: {
      legend: { position: "bottom" as const, labels: { color: "#E2E8F0", usePointStyle: true } },
      tooltip: {
        backgroundColor: "rgba(10,18,48,0.95)",
        borderColor: "rgba(0,212,255,0.35)",
        borderWidth: 1,
      },
    },
  };
  return (
    <div style={{ height }}>
      <PolarArea data={chartData} options={options} />
    </div>
  );
}
