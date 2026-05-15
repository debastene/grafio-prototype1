"use client";
import { Fragment } from "react";

type Props = {
  rows: string[];
  cols: string[];
  values: number[][];
  height?: number;
};

/**
 * Lightweight CSS-grid heatmap — each cell colored by intensity.
 */
export default function Heatmap({ rows, cols, values, height = 320 }: Props) {
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);

  const colorFor = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    const alpha = 0.15 + t * 0.85;
    return `rgba(0, 212, 255, ${alpha})`;
  };

  return (
    <div style={{ height }} className="overflow-auto">
      <div
        className="grid gap-1 min-w-full"
        style={{
          gridTemplateColumns: `auto repeat(${cols.length}, minmax(48px, 1fr))`,
        }}
      >
        <div />
        {cols.map((c) => (
          <div key={`c-${c}`} className="text-[11px] text-muted text-center pb-1">
            {c}
          </div>
        ))}
        {rows.map((r, i) => (
          <Fragment key={`row-${r}`}>
            <div className="text-[11px] text-muted pr-2 flex items-center justify-end">{r}</div>
            {cols.map((col, j) => {
              const v = values[i]?.[j] ?? 0;
              return (
                <div
                  key={`${i}-${j}`}
                  className="aspect-square rounded flex items-center justify-center text-[10px] text-white/90 font-mono transition-transform hover:scale-110 hover:z-10 hover:ring-2 hover:ring-cyan/60"
                  style={{ background: colorFor(v) }}
                  title={`${r} × ${col}: ${v}`}
                >
                  {v}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
