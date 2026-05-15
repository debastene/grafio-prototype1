"use client";
import { Line } from "react-chartjs-2";
import { ensureRegistered, rgba } from "./registry";

ensureRegistered();

type Props = { data: number[]; color?: string; height?: number };

export default function Sparkline({ data, color = "#00D4FF", height = 48 }: Props) {
  const chartData = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: (ctx: any) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return rgba(color, 0.15);
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, rgba(color, 0.5));
          grad.addColorStop(1, rgba(color, 0));
          return grad;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: { point: { radius: 0 } },
  };
  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
