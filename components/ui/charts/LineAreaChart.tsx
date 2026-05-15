"use client";
import { Line } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE, rgba } from "./registry";

ensureRegistered();

type Series = { label: string; data: number[]; color?: string };
type Props = { labels: string[]; series: Series[]; height?: number };

export default function LineAreaChart({ labels, series, height = 320 }: Props) {
  const data = {
    labels,
    datasets: series.map((s, i) => {
      const color = s.color ?? Object.values(PALETTE)[i % 9];
      return {
        label: s.label,
        data: s.data,
        borderColor: color,
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return rgba(color, 0.18);
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, rgba(color, 0.42));
          grad.addColorStop(1, rgba(color, 0));
          return grad;
        },
        tension: 0.45,
        fill: true,
        pointBackgroundColor: color,
        pointBorderColor: "#05081A",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.5,
      };
    }),
  };
  return (
    <div style={{ height }}>
      <Line data={data} options={baseOptions} />
    </div>
  );
}
