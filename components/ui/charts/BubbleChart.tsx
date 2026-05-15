"use client";
import { Bubble } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE_ARR, rgba } from "./registry";

ensureRegistered();

type Point = { x: number; y: number; r: number };
type Series = { label: string; data: Point[]; color?: string };
type Props = { series: Series[]; height?: number };

export default function BubbleChart({ series, height = 320 }: Props) {
  const data = {
    datasets: series.map((s, i) => {
      const color = s.color ?? PALETTE_ARR[i % PALETTE_ARR.length];
      return {
        label: s.label,
        data: s.data,
        backgroundColor: rgba(color, 0.55),
        borderColor: color,
        borderWidth: 1.5,
      };
    }),
  };
  return (
    <div style={{ height }}>
      <Bubble data={data} options={baseOptions} />
    </div>
  );
}
