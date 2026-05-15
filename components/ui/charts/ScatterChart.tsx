"use client";
import { Scatter } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE_ARR, rgba } from "./registry";

ensureRegistered();

type Series = { label: string; data: { x: number; y: number }[]; color?: string };
type Props = { series: Series[]; height?: number };

export default function ScatterChart({ series, height = 320 }: Props) {
  const data = {
    datasets: series.map((s, i) => {
      const color = s.color ?? PALETTE_ARR[i % PALETTE_ARR.length];
      return {
        label: s.label,
        data: s.data,
        backgroundColor: rgba(color, 0.7),
        borderColor: color,
        pointRadius: 6,
        pointHoverRadius: 9,
      };
    }),
  };
  return (
    <div style={{ height }}>
      <Scatter data={data} options={baseOptions} />
    </div>
  );
}
