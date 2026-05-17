/**
 * Generator tutorial cara membuat chart yang sama di platform lain.
 * Dipakai oleh ChartDetailModal supaya user bisa replikasi chart Grafio
 * di Excel / Google Sheets / Power BI.
 *
 * Filosofi: SINGKAT, 3-5 langkah per platform. User awam fokus, bukan
 * jadi PhD tutorial. Sebut nama kolom user kalau diberikan.
 */

export type Platform = "excel" | "sheets" | "powerbi";

export type ChartKind =
  | "bar"
  | "bar-stacked"
  | "bar-horizontal"
  | "line"
  | "area"
  | "doughnut"
  | "pie"
  | "scatter"
  | "bubble"
  | "radar"
  | "polar"
  | "heatmap"
  | "mixed"
  | "histogram";

export type ColumnRole = {
  /** original column name as user knows it */
  name: string;
  /** explanation: what role this column plays in the chart */
  role: string;
};

export type Tutorial = {
  platform: Platform;
  /** Display name */
  label: string;
  /** Emoji for tab */
  icon: string;
  /** 3-5 step instructions */
  steps: string[];
};

const PLATFORM_META: Record<Platform, { label: string; icon: string }> = {
  excel: { label: "Excel", icon: "📊" },
  sheets: { label: "Google Sheets", icon: "📈" },
  powerbi: { label: "Power BI", icon: "📉" },
};

/**
 * Pretty name for chart type in user-facing UI.
 */
export function chartKindLabel(kind: ChartKind): string {
  const map: Record<ChartKind, string> = {
    bar: "Bar Chart (vertikal)",
    "bar-stacked": "Stacked Bar Chart",
    "bar-horizontal": "Horizontal Bar Chart",
    line: "Line Chart",
    area: "Area Chart",
    doughnut: "Doughnut Chart",
    pie: "Pie Chart",
    scatter: "Scatter Plot",
    bubble: "Bubble Chart",
    radar: "Radar Chart",
    polar: "Polar Area Chart",
    heatmap: "Heatmap",
    mixed: "Combo Chart (bar + line)",
    histogram: "Histogram",
  };
  return map[kind];
}

/**
 * Map ChartKind → Excel chart subtype name di ribbon.
 */
const EXCEL_INSERT_NAME: Record<ChartKind, string> = {
  bar: "Insert → Column / Clustered Column",
  "bar-stacked": "Insert → Column → Stacked Column",
  "bar-horizontal": "Insert → Bar → Clustered Bar",
  line: "Insert → Line → Line with Markers",
  area: "Insert → Area → Area",
  doughnut: "Insert → Pie → Doughnut",
  pie: "Insert → Pie → 2-D Pie",
  scatter: "Insert → Scatter → Scatter (markers only)",
  bubble: "Insert → Scatter → Bubble",
  radar: "Insert → Surface or Radar → Radar with Markers",
  polar: "(tidak ada di Excel langsung — pakai Doughnut + custom rotation)",
  heatmap: "Conditional Formatting → Color Scales (di range data)",
  mixed: "Insert → Combo → Clustered Column - Line",
  histogram: "Insert → Statistical → Histogram",
};

const SHEETS_CHART_TYPE: Record<ChartKind, string> = {
  bar: "Column chart",
  "bar-stacked": "Stacked column chart",
  "bar-horizontal": "Bar chart",
  line: "Line chart",
  area: "Area chart",
  doughnut: "Doughnut chart",
  pie: "Pie chart",
  scatter: "Scatter chart",
  bubble: "Bubble chart",
  radar: "Radar chart",
  polar: "(tidak tersedia native — pakai Doughnut)",
  heatmap: "(tidak tersedia native — pakai Conditional formatting di range)",
  mixed: "Combo chart",
  histogram: "Histogram chart",
};

const POWERBI_VISUAL: Record<ChartKind, string> = {
  bar: "Clustered column chart",
  "bar-stacked": "Stacked column chart",
  "bar-horizontal": "Clustered bar chart",
  line: "Line chart",
  area: "Area chart",
  doughnut: "Donut chart",
  pie: "Pie chart",
  scatter: "Scatter chart",
  bubble: "Scatter chart (drag field ke 'Size')",
  radar: "(custom visual: download 'Radar Chart' dari AppSource)",
  polar: "(custom visual)",
  heatmap: "Matrix dengan Conditional formatting",
  mixed: "Line and clustered column chart",
  histogram: "(custom visual: 'Histogram with points')",
};

function columnsBullet(cols: ColumnRole[]): string {
  if (cols.length === 0) return "kolom utama dataset kamu";
  return cols.map((c) => `\`${c.name}\` (${c.role})`).join(", ");
}

/**
 * Generate tutorial untuk 1 platform.
 */
export function buildTutorial(
  platform: Platform,
  kind: ChartKind,
  columns: ColumnRole[],
): Tutorial {
  const meta = PLATFORM_META[platform];
  const cols = columnsBullet(columns);

  let steps: string[] = [];

  if (platform === "excel") {
    steps = [
      `Buka file CSV kamu di Excel. Pastikan baris pertama adalah header.`,
      `Pilih (highlight) range kolom: ${cols}.`,
      EXCEL_INSERT_NAME[kind],
      `Klik chart → tab 'Chart Design' → pilih layout & color scheme yang kontras.`,
      `Beri judul: klik 'Chart Title' → ketik nama deskriptif (mis. nama chart di Grafio).`,
    ];
  } else if (platform === "sheets") {
    steps = [
      `Buka data kamu di Google Sheets (atau File → Import file CSV).`,
      `Highlight range kolom: ${cols}.`,
      `Klik menu Insert → Chart.`,
      `Di panel kanan 'Chart editor' → Setup tab → Chart type → pilih **${SHEETS_CHART_TYPE[kind]}**.`,
      `Customize tab → Chart & axis titles → beri judul yang jelas.`,
    ];
  } else {
    // powerbi
    steps = [
      `Power BI Desktop → Home → Get data → Text/CSV → load file kamu.`,
      `Di panel 'Visualizations' (kanan) → klik ikon **${POWERBI_VISUAL[kind]}**.`,
      `Drag kolom ${cols} ke field wells yang sesuai (Axis / Values / Legend).`,
      `Format pane (ikon kuas) → Title → ketik nama chart. Atur warna & font.`,
      `Save sebagai .pbix atau publish ke Power BI Service untuk share.`,
    ];
  }

  return { platform, label: meta.label, icon: meta.icon, steps };
}

/**
 * Generate semua 3 tutorial sekaligus (Excel, Sheets, Power BI).
 */
export function buildAllTutorials(kind: ChartKind, columns: ColumnRole[]): Tutorial[] {
  return (["excel", "sheets", "powerbi"] as Platform[]).map((p) =>
    buildTutorial(p, kind, columns),
  );
}
