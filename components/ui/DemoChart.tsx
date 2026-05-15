"use client";
import LineAreaChart from "./charts/LineAreaChart";

export default function DemoChart() {
  return (
    <LineAreaChart
      labels={["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"]}
      series={[
        { label: "Penjualan", data: [45200, 52100, 38900, 61500, 57800, 68400], color: "#00D4FF" },
        { label: "Target", data: [40000, 45000, 50000, 50000, 55000, 60000], color: "#7B5EA7" },
        { label: "Profit", data: [12300, 15800, 9200, 19400, 17900, 22300], color: "#00FFB3" },
      ]}
    />
  );
}
