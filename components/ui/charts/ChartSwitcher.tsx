"use client";
import { useState } from "react";
import { LineChart as LineIcon, BarChart3, PieChart, Radar as RadarIcon } from "lucide-react";
import LineAreaChart from "./LineAreaChart";
import BarChart from "./BarChart";
import DoughnutChart from "./DoughnutChart";
import RadarChart from "./RadarChart";

type Tab = "line" | "bar" | "doughnut" | "radar";

const tabs: { id: Tab; label: string; Icon: any }[] = [
  { id: "line", label: "Line", Icon: LineIcon },
  { id: "bar", label: "Bar", Icon: BarChart3 },
  { id: "doughnut", label: "Doughnut", Icon: PieChart },
  { id: "radar", label: "Radar", Icon: RadarIcon },
];

type Props = {
  labels: string[];
  series: { label: string; data: number[] }[];
};

export default function ChartSwitcher({ labels, series }: Props) {
  const [active, setActive] = useState<Tab>("line");

  const sumPerLabel = labels.map((_, i) =>
    series.reduce((acc, s) => acc + (s.data[i] ?? 0), 0),
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              active === id
                ? "bg-cyan text-bgDeep shadow-glow"
                : "text-muted border border-borderColor hover:border-cyan/50 hover:text-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="reveal" key={active}>
        {active === "line" && <LineAreaChart labels={labels} series={series} />}
        {active === "bar" && <BarChart labels={labels} series={series} />}
        {active === "doughnut" && (
          <DoughnutChart labels={labels} data={sumPerLabel} centerLabel={sumPerLabel.reduce((a, b) => a + b, 0).toLocaleString("id")} />
        )}
        {active === "radar" && <RadarChart labels={labels} series={series} />}
      </div>
    </div>
  );
}
