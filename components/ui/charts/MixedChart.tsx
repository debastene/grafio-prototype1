"use client";
import { Chart } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE, rgba } from "./registry";

ensureRegistered();

type Props = {
  labels: string[];
  bars: { label: string; data: number[]; color?: string }[];
  lines: { label: string; data: number[]; color?: string }[];
  height?: number;
};

export default function MixedChart({ labels, bars, lines, height = 320 }: Props) {
  const data: any = {
    labels,
    datasets: [
      ...bars.map((b, i) => {
        const c = b.color ?? Object.values(PALETTE)[i % 9];
        return {
          type: "bar" as const,
          label: b.label,
          data: b.data,
          backgroundColor: rgba(c, 0.65),
          borderColor: c,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2,
        };
      }),
      ...lines.map((l, i) => {
        const c = l.color ?? Object.values(PALETTE)[(i + bars.length) % 9];
        return {
          type: "line" as const,
          label: l.label,
          data: l.data,
          borderColor: c,
          backgroundColor: rgba(c, 0.1),
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: c,
          pointBorderColor: "#05081A",
          pointBorderWidth: 2,
          pointRadius: 4,
          fill: false,
          order: 1,
        };
      }),
    ],
  };
  return (
    <div style={{ height }}>
      <Chart type="bar" data={data} options={baseOptions} />
    </div>
  );
}
