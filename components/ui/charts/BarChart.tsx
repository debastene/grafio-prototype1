"use client";
import { Bar } from "react-chartjs-2";
import { ensureRegistered, baseOptions, PALETTE, rgba } from "./registry";

ensureRegistered();

type Series = { label: string; data: number[]; color?: string };
type Props = {
  labels: string[];
  series: Series[];
  stacked?: boolean;
  horizontal?: boolean;
  height?: number;
};

export default function BarChart({ labels, series, stacked = false, horizontal = false, height = 320 }: Props) {
  const data = {
    labels,
    datasets: series.map((s, i) => {
      const color = s.color ?? Object.values(PALETTE)[i % 9];
      return {
        label: s.label,
        data: s.data,
        backgroundColor: rgba(color, 0.75),
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: color,
      };
    }),
  };
  const options: any = {
    ...baseOptions,
    indexAxis: horizontal ? ("y" as const) : ("x" as const),
    scales: {
      x: { ...baseOptions.scales!.x, stacked },
      y: { ...baseOptions.scales!.y, stacked },
    },
  };
  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
