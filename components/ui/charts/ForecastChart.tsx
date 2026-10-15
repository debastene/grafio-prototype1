"use client";
import { Line } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE, rgba } from "./registry";
import { compactNumber } from "@/lib/engine/stats";

ensureRegistered();

type Props = {
  labels: string[];
  history: number[];
  futureLabels: string[];
  mean: number[];
  lower: number[];
  upper: number[];
  height?: number;
  /** Format angka untuk tooltip & sumbu Y. */
  format?: (v: number) => string;
};

/**
 * Aktual (garis cyan) + ramalan (garis putus-putus amber) + pita interval 95%.
 * Ramalan & pita disambung ke titik aktual terakhir supaya garisnya kontinu.
 */
export default function ForecastChart({ labels, history, futureLabels, mean, lower, upper, height = 300, format }: Props) {
  const f = format ?? compactNumber;
  const n = history.length;
  const h = mean.length;
  const pad = (k: number) => new Array<number | null>(k).fill(null);
  const last = history[n - 1];
  const tail = (v: number[]) => [...pad(n - 1), last, ...v];

  const data = {
    labels: [...labels, ...futureLabels],
    datasets: [
      {
        label: "Aktual",
        data: [...history, ...pad(h)],
        borderColor: PALETTE.cyan,
        backgroundColor: PALETTE.cyan,
        borderWidth: 2,
        pointRadius: n > 40 ? 0 : 2.5,
        tension: 0.2,
      },
      {
        label: "Batas bawah 95%",
        data: tail(lower),
        borderColor: rgba(PALETTE.amber, 0.35),
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      {
        label: "Rentang 95%",
        data: tail(upper),
        borderColor: rgba(PALETTE.amber, 0.35),
        backgroundColor: rgba(PALETTE.amber, 0.14),
        borderWidth: 1,
        pointRadius: 0,
        fill: "-1",
      },
      {
        label: "Ramalan",
        data: tail(mean),
        borderColor: PALETTE.amber,
        backgroundColor: PALETTE.amber,
        borderDash: [6, 4],
        borderWidth: 2.5,
        pointRadius: (ctx: { dataIndex: number }) => (ctx.dataIndex >= n ? 3 : 0),
        tension: 0,
      },
    ],
  };

  const options = {
    ...baseOptions,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          ...baseOptions.plugins.legend.labels,
          filter: (item: { text: string }) => item.text !== "Batas bawah 95%",
        },
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        filter: (item: { dataIndex: number; dataset: { label?: string } }) =>
          // Titik sambungan (aktual terakhir) tidak perlu diulang di seri ramalan.
          !(item.dataIndex === n - 1 && item.dataset.label !== "Aktual"),
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${f(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: number | string) => f(Number(v)) } },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
