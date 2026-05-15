"use client";
import { Radar } from "react-chartjs-2";
import { ensureRegistered, PALETTE_ARR, rgba } from "./registry";

ensureRegistered();

type Series = { label: string; data: number[]; color?: string };
type Props = { labels: string[]; series: Series[]; height?: number };

export default function RadarChart({ labels, series, height = 340 }: Props) {
  const data = {
    labels,
    datasets: series.map((s, i) => {
      const color = s.color ?? PALETTE_ARR[i % PALETTE_ARR.length];
      return {
        label: s.label,
        data: s.data,
        borderColor: color,
        backgroundColor: rgba(color, 0.22),
        pointBackgroundColor: color,
        pointBorderColor: "#05081A",
        pointRadius: 4,
        borderWidth: 2,
      };
    }),
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: "rgba(255,255,255,0.08)" },
        grid: { color: "rgba(255,255,255,0.08)" },
        pointLabels: { color: "#E2E8F0", font: { size: 12 } },
        ticks: { color: "#7A88AC", backdropColor: "transparent" },
      },
    },
    plugins: {
      legend: { labels: { color: "#E2E8F0", usePointStyle: true } },
      tooltip: {
        backgroundColor: "rgba(10,18,48,0.95)",
        borderColor: "rgba(0,212,255,0.35)",
        borderWidth: 1,
      },
    },
  };
  return (
    <div style={{ height }}>
      <Radar data={data} options={options} />
    </div>
  );
}
