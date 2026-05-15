"use client";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  Title,
  TimeScale,
  type ChartOptions,
} from "chart.js";

let registered = false;
export function ensureRegistered() {
  if (registered) return;
  ChartJS.register(
    LineElement,
    BarElement,
    PointElement,
    ArcElement,
    RadialLinearScale,
    CategoryScale,
    LinearScale,
    TimeScale,
    Tooltip,
    Legend,
    Filler,
    Title,
  );
  ChartJS.defaults.color = "#7A88AC";
  ChartJS.defaults.font.family = "var(--font-dm), system-ui, sans-serif";
  registered = true;
}

export const PALETTE = {
  cyan: "#00D4FF",
  cyanSoft: "#7DE3FF",
  purple: "#7B5EA7",
  mint: "#00FFB3",
  pink: "#FF6FB5",
  amber: "#FFB547",
  red: "#FF4D6D",
  blue: "#3D8BFF",
  silver: "#E2E8F0",
};

export const PALETTE_ARR = Object.values(PALETTE);

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export const baseOptions: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "#E2E8F0", font: { size: 12, family: "var(--font-dm)" }, usePointStyle: true, pointStyle: "circle" },
    },
    tooltip: {
      backgroundColor: "rgba(10,18,48,0.95)",
      borderColor: "rgba(0,212,255,0.35)",
      borderWidth: 1,
      titleColor: "#E2E8F0",
      bodyColor: "#E2E8F0",
      padding: 12,
      boxPadding: 6,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      ticks: { color: "#7A88AC" },
      grid: { color: "rgba(255,255,255,0.04)" },
      border: { color: "rgba(255,255,255,0.06)" },
    },
    y: {
      ticks: { color: "#7A88AC" },
      grid: { color: "rgba(255,255,255,0.04)" },
      border: { color: "rgba(255,255,255,0.06)" },
    },
  },
};
