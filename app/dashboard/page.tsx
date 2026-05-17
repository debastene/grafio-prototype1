"use client";
import { useState, useMemo, Fragment } from "react";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import UploadZone from "@/components/ui/UploadZone";
import InsightPanel from "@/components/ui/InsightPanel";
import AiAssistant from "@/components/ui/AiAssistant";
import AnalysisLauncher, { AiResult } from "@/components/ui/AnalysisLauncher";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import KpiCard from "@/components/ui/charts/KpiCard";
import BarChart from "@/components/ui/charts/BarChart";
import DoughnutChart from "@/components/ui/charts/DoughnutChart";
import RadarChart from "@/components/ui/charts/RadarChart";
import PolarChart from "@/components/ui/charts/PolarChart";
import ScatterChart from "@/components/ui/charts/ScatterChart";
import BubbleChart from "@/components/ui/charts/BubbleChart";
import MixedChart from "@/components/ui/charts/MixedChart";
import Heatmap from "@/components/ui/charts/Heatmap";
import ChartSwitcher from "@/components/ui/charts/ChartSwitcher";
import LineAreaChart from "@/components/ui/charts/LineAreaChart";
import ChartFrame from "@/components/ui/charts/ChartFrame";
import {
  Share2, RefreshCw, Sparkles,
  FileText, Copy, Check, Cpu, Database, AlertTriangle, Loader2,
  Lightbulb, MessageSquare, Save, FolderOpen, X as XIcon,
} from "lucide-react";
import { saveProject } from "@/lib/db/projects";
import { SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import { getSession } from "@/lib/auth/storage";
import Link from "next/link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu"];
const SPARK_COLORS = ["#00D4FF", "#00FFB3", "#FF6FB5", "#7B5EA7"];

type Mode = "upload" | "demo" | "ai";

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [range, setRange] = useState<"1M" | "3M" | "6M" | "1Y">("6M");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  /** True setelah AnalysisLauncher berhasil inspect file — UploadZone disembunyikan. */
  const [inspectionStarted, setInspectionStarted] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [toast, setToast] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);

  const showToast = (type: "info" | "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const onSaveProject = async () => {
    if (!aiResult) return;
    if (!SUPABASE_CONFIGURED) {
      setSaveError("Database belum di-setup. Hubungi admin.");
      setSaveState("error");
      return;
    }
    const session = getSession();
    if (!session) {
      // Send user to login, return to dashboard after
      window.location.href = "/login?next=/dashboard";
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    const res = await saveProject({ result: aiResult });
    if (!res.ok) {
      setSaveState("error");
      setSaveError(res.error);
      return;
    }
    setSaveState("saved");
    setSavedProjectId(res.id);
    setTimeout(() => setSaveState("idle"), 4000);
  };

  const monthsRange = useMemo(() => {
    if (range === "1M") return MONTHS.slice(-1);
    if (range === "3M") return MONTHS.slice(-3);
    if (range === "6M") return MONTHS.slice(0, 6);
    return MONTHS;
  }, [range]);

  const demoSales = [45200, 52100, 38900, 61500, 57800, 68400, 72100, 79300].slice(0, monthsRange.length);
  const demoTarget = [40000, 45000, 50000, 50000, 55000, 60000, 65000, 70000].slice(0, monthsRange.length);
  const demoProfit = [12300, 15800, 9200, 19400, 17900, 22300, 24500, 27800].slice(0, monthsRange.length);

  const generatePdf = async () => {
    if (!aiResult) {
      showToast("error", "Tidak ada hasil analisis. Upload data & jalankan analisis dulu.");
      return;
    }
    setPdfLoading(true);
    try {
      const { downloadReport } = await import("@/lib/report/pdf");
      await downloadReport(aiResult);
      showToast("success", "PDF Report berhasil di-generate");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast("error", `Gagal generate PDF: ${msg}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Grafio Dashboard", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1800);
      }
    } catch {
      /* user cancelled */
    }
  };

  const reset = () => {
    setMode("upload");
    setFiles([]);
    setAiResult(null);
    setInspectionStarted(false);
    setShowFullPreview(false);
  };

  /** Callback dari AnalysisLauncher saat user pencet "Ganti file" di wizard. */
  const handleResetFile = () => {
    setFiles([]);
    setInspectionStarted(false);
  };

  const showResults = mode === "demo" || mode === "ai";

  // ===== KPI cards
  const kpiCards = useMemo(() => {
    if (mode === "ai" && aiResult?.kpis?.length) {
      return aiResult.kpis.slice(0, 4).map((k, i) => ({
        ...k,
        spark: Array.from({ length: 8 }, (_, j) =>
          20 + Math.round(Math.sin(i + j / 2) * 15 + j * (k.change >= 0 ? 2 : -1.2)),
        ),
        color: SPARK_COLORS[i % SPARK_COLORS.length],
      }));
    }
    return [
      { label: "Total Revenue", value: "Rp 475M", change: 12.4, spark: [20, 30, 28, 41, 38, 52, 60, 68], color: "#00D4FF" },
      { label: "Customers", value: "12.8K", change: 8.1, spark: [10, 12, 18, 22, 28, 34, 41, 48], color: "#00FFB3" },
      { label: "ROAS", value: "3.4×", change: -2.3, spark: [40, 38, 41, 35, 32, 30, 28, 30], color: "#FF6FB5" },
      { label: "Avg Order", value: "Rp 285K", change: 4.7, spark: [28, 30, 31, 33, 32, 34, 35, 37], color: "#7B5EA7" },
    ];
  }, [mode, aiResult]);

  // ===== Primary chart data (real data in AI mode, demo data otherwise)
  const primaryChart = useMemo(() => {
    if (mode === "ai" && aiResult?.charts?.primary?.series.length) {
      return {
        labels: aiResult.charts.primary.labels,
        series: aiResult.charts.primary.series,
        title: aiResult.analysis.primaryDateCol
          ? `Tren Time-Series — ${aiResult.charts.primary.series.map((s) => s.label).join(", ")}`
          : aiResult.analysis.primaryCategoryCol
            ? `${aiResult.charts.primary.series[0].label} per ${aiResult.analysis.primaryCategoryCol}`
            : "Data Series",
      };
    }
    return {
      labels: monthsRange,
      series: [
        { label: "Sales", data: demoSales },
        { label: "Target", data: demoTarget },
        { label: "Profit", data: demoProfit },
      ],
      title: "Sales vs Target vs Profit",
    };
  }, [mode, aiResult, monthsRange]);

  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50" />
      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan mb-2">Dashboard</p>
            <h1 className="text-3xl md:text-4xl font-syne font-bold text-white">Workspace Analitik</h1>
            <p className="text-muted text-sm mt-1">
              {mode === "ai" && aiResult
                ? `Analisis ${aiResult._meta?.model ?? "Grafio Engine"} · ${aiResult.fileName} · ${aiResult.rowCount} baris × ${aiResult.columnCount} kolom · ${aiResult.durationMs.toFixed(0)} ms`
                : mode === "demo"
                  ? "Laporan demo · sales pipeline · 8 bulan"
                  : files.length
                    ? "File siap dianalisis — beri arahan ke Engine di bawah"
                    : "Mulai dengan upload data atau coba demo"}
            </p>
          </div>
          {showResults && (
            <div className="flex items-center gap-2 flex-wrap">
              {mode === "demo" && (
                <div className="flex items-center gap-1 bg-bgSurface border border-borderColor rounded-md p-1">
                  {(["1M", "3M", "6M", "1Y"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`px-3 py-1 text-xs rounded transition-all ${
                        range === r ? "bg-cyan text-bgDeep font-semibold" : "text-muted hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={reset}>
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>
          )}
        </div>

        {/* UPLOAD + LAUNCHER — UploadZone hilang ketika inspect sudah jalan */}
        {mode === "upload" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {!inspectionStarted && (
              <UploadZone onDemo={() => setMode("demo")} onFiles={setFiles} />
            )}
            {files.length > 0 && (
              <AnalysisLauncher
                files={files}
                onComplete={(r) => {
                  setAiResult(r);
                  setMode("ai");
                }}
                onInspectStart={() => setInspectionStarted(true)}
                onResetFile={handleResetFile}
              />
            )}
          </div>
        )}

        {/* RESULTS */}
        {showResults && (
          <div className="space-y-6">
            {/* AI SUMMARY BANNER */}
            {mode === "ai" && aiResult && (
              <div className="glass rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan/15 blur-3xl rounded-full pointer-events-none" />
                <div className="relative flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-cyan" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="font-syne font-bold text-white">Ringkasan Eksekutif</p>
                      <span className="text-[10px] uppercase tracking-widest text-mint bg-mint/10 px-2 py-0.5 rounded-full border border-mint/30">
                        {aiResult._meta?.model ?? "Grafio Engine"}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/30">
                        {aiResult.recommendedCharts.slice(0, 4).join(" · ")}
                      </span>
                    </div>
                    <p className="text-sm text-white leading-relaxed">{aiResult.summary}</p>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-muted font-mono flex-wrap">
                      <span>numeric: {aiResult.numericColCount}</span>
                      <span>categorical: {aiResult.categoricalColCount}</span>
                      <span>date: {aiResult.dateColCount}</span>
                      <span>·</span>
                      <span>{aiResult.analysis.trends.length} trends</span>
                      <span>{aiResult.analysis.correlations.length} correlations</span>
                      <span>{aiResult.analysis.anomalies.reduce((a, b) => a + b.count, 0)} outliers</span>
                      <span>{aiResult.analysis.segments.length} segments</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI CONCLUSION + USER CONTEXT CARD */}
            {mode === "ai" && aiResult && (aiResult.conclusion || aiResult.userContext) && (
              <div className="grid md:grid-cols-3 gap-4">
                {aiResult.conclusion && (
                  <div className={`glass rounded-2xl p-5 relative overflow-hidden ${aiResult.userContext ? "md:col-span-2" : "md:col-span-3"} border border-purple/20 bg-gradient-to-br from-purple/8 to-transparent`}>
                    <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-purple/15 blur-3xl rounded-full pointer-events-none" />
                    <div className="relative flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-5 h-5 text-purple" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <p className="font-syne font-bold text-white">Kesimpulan Grafio</p>
                          <span className="text-[10px] uppercase tracking-widest text-purple bg-purple/10 px-2 py-0.5 rounded-full border border-purple/30">
                            sudut pandang AI
                          </span>
                        </div>
                        <p className="text-sm text-white leading-relaxed italic">
                          {aiResult.conclusion}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {aiResult.userContext && (
                  <div className="glass rounded-2xl p-5 border border-mint/20 bg-gradient-to-br from-mint/8 to-transparent">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-mint" />
                      <p className="font-syne font-bold text-white text-sm">Konteks Dari Kamu</p>
                    </div>
                    <p className="text-xs text-white leading-relaxed italic">
                      &ldquo;{aiResult.userContext}&rdquo;
                    </p>
                    <p className="text-[10px] text-muted mt-2 leading-relaxed">
                      Grafio menyusun analisis dengan mempertimbangkan konteks ini.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* COLUMN PROFILE — only AI mode */}
            {mode === "ai" && aiResult && aiResult.profile.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan" />
                    <h3 className="font-syne font-semibold text-white text-sm">Profil Kolom Terdeteksi</h3>
                  </div>
                  <span className="text-[10px] text-muted">{aiResult.profile.length} kolom</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted border-b border-borderColor">
                        <th className="py-2 pr-4">Kolom</th>
                        <th className="py-2 pr-4">Tipe</th>
                        <th className="py-2 pr-4 text-right">Unique</th>
                        <th className="py-2 pr-4 text-right">Missing</th>
                        <th className="py-2 pr-4 text-right">Mean / Top</th>
                        <th className="py-2 pr-4 text-right">Range / Mode</th>
                        <th className="py-2 pr-4 text-right">Outlier</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {aiResult.profile.slice(0, 12).map((p) => (
                        <tr key={p.name} className="border-b border-borderColor/50 hover:bg-bgElevated/40">
                          <td className="py-2 pr-4 font-mono truncate max-w-[180px]" title={p.name}>
                            {p.isLikelyTarget && <span className="text-mint mr-1">★</span>}
                            {p.name}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${typeColor(p.type)}`}>
                              {p.type}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">{p.unique}</td>
                          <td className={`py-2 pr-4 text-right font-mono ${p.missingPct > 0.2 ? "text-warning" : "text-muted"}`}>
                            {(p.missingPct * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-muted">
                            {p.summary
                              ? p.summary.mean.toLocaleString("id", { maximumFractionDigits: 2 })
                              : p.topValues?.[0]?.value ?? "—"}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-muted">
                            {p.summary
                              ? `${p.summary.min.toLocaleString("id", { maximumFractionDigits: 1 })} → ${p.summary.max.toLocaleString("id", { maximumFractionDigits: 1 })}`
                              : p.topValues?.length
                                ? `${p.topValues.length} cat`
                                : "—"}
                          </td>
                          <td className={`py-2 pr-4 text-right font-mono ${(p.outlierCount ?? 0) > 0 ? "text-warning" : "text-muted"}`}>
                            {p.outlierCount ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {aiResult.profile.length > 12 && (
                  <p className="text-[10px] text-muted mt-2">
                    Menampilkan 12 dari {aiResult.profile.length} kolom.
                  </p>
                )}
              </Card>
            )}

            {/* KPI ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpiCards.map((k, i) => (
                <KpiCard key={i} {...k} />
              ))}
            </div>

            {/* MAIN CHART + AI CHAT */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChartFrame
                  id="chart-primary"
                  name={primaryChart.title}
                  category={mode === "ai" ? "Chart Utama · Recommended by Engine" : "Chart Utama · Demo"}
                  subtitle={
                    mode === "ai" && aiResult
                      ? `${aiResult.charts.primary.series.length} seri data · ${aiResult.charts.primary.labels.length} titik`
                      : undefined
                  }
                  source={mode === "ai" && aiResult ? aiResult.fileName : "Demo dataset"}
                  insight={mode === "ai" ? aiResult?.chartInsights?.["chart-primary"] : undefined}
                  detail={{
                    chartKind: "line",
                    columnsUsed:
                      mode === "ai" && aiResult
                        ? [
                            {
                              name:
                                aiResult.analysis.primaryDateCol ??
                                aiResult.analysis.primaryCategoryCol ??
                                "kategori / waktu",
                              role: "axis X (kategori / waktu)",
                            },
                            ...aiResult.charts.primary.series.map((s) => ({
                              name: s.label,
                              role: "axis Y (nilai numerik)",
                            })),
                          ]
                        : [
                            { name: "Bulan", role: "axis X (kategori)" },
                            { name: "Penjualan / Target / Profit", role: "axis Y (nilai)" },
                          ],
                    renderChart: (h) => (
                      <div style={{ height: h }}>
                        <ChartSwitcher labels={primaryChart.labels} series={primaryChart.series} />
                      </div>
                    ),
                  }}
                >
                  <ChartSwitcher labels={primaryChart.labels} series={primaryChart.series} />
                </ChartFrame>
              </div>
              <div>
                <AiAssistant context={mode === "ai" ? aiResult : null} />
              </div>
            </div>

            {/* INSIGHTS */}
            <InsightPanel
              insights={
                mode === "ai" && aiResult?.insights?.length
                  ? aiResult.insights
                  : undefined
              }
            />

            {/* CORRELATION HEATMAP */}
            {mode === "ai" && aiResult?.analysis.correlationMatrix && (
              <ChartFrame
                id="chart-correlation-matrix"
                name="Matriks Korelasi Pearson"
                category="Correlation Matrix"
                subtitle={`Pearson r untuk ${aiResult.analysis.correlationMatrix.columns.length} kolom numerik utama · biru = positif, merah = negatif`}
                source={aiResult.fileName}
                insight={aiResult.chartInsights?.["chart-correlation-matrix"]}
                detail={{
                  chartKind: "heatmap",
                  columnsUsed: aiResult.analysis.correlationMatrix.columns.map((c) => ({
                    name: c,
                    role: "axis kolom & baris matriks",
                  })),
                  renderChart: () => <CorrHeatmap matrix={aiResult.analysis.correlationMatrix!} />,
                }}
              >
                <CorrHeatmap matrix={aiResult.analysis.correlationMatrix} />
              </ChartFrame>
            )}

            {/* ENGINE-SPECIFIC: TOP CORRELATIONS */}
            {mode === "ai" && aiResult && aiResult.analysis.correlations.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan">Pearson Correlation</p>
                    <h4 className="font-syne font-semibold text-white text-sm">
                      Top {aiResult.analysis.correlations.length} pasangan kolom
                    </h4>
                  </div>
                </div>
                <div className="space-y-2">
                  {aiResult.analysis.correlations.map((c, i) => {
                    const pct = Math.round(Math.abs(c.r) * 100);
                    const positive = c.r > 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <p className="text-xs text-white truncate font-mono" title={`${c.a} ↔ ${c.b}`}>
                              {c.a} <span className="text-muted">↔</span> {c.b}
                            </p>
                            <span className={`text-[11px] font-mono ${positive ? "text-mint" : "text-danger"}`}>
                              r = {c.r.toFixed(3)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-bgSurface rounded-full overflow-hidden">
                            <div
                              className={`h-full ${positive ? "bg-mint" : "bg-danger"} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${positive ? "text-mint border-mint/30 bg-mint/10" : "text-danger border-danger/30 bg-danger/10"}`}>
                          {c.strength}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* CHART GRID — semua chart pakai ChartFrame (screenshot-ready, named) */}
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-5">
              {/* Distribution / Doughnut */}
              {mode === "ai" && aiResult?.charts?.distribution ? (
                <ChartFrame
                  id="chart-distribution"
                  name={`Distribusi ${aiResult.analysis.primaryCategoryCol ?? "Kategori"}`}
                  category="Distribution"
                  subtitle={`${aiResult.charts.distribution.labels.length} kategori unik`}
                  source={aiResult.fileName}
                  insight={aiResult.chartInsights?.["chart-distribution"]}
                  detail={{
                    chartKind: "doughnut",
                    columnsUsed: [
                      {
                        name: aiResult.analysis.primaryCategoryCol ?? "kategori",
                        role: "label kategori (slices)",
                      },
                      { name: "(count / frekuensi)", role: "nilai per slice" },
                    ],
                    renderChart: (h) => (
                      <DoughnutChart
                        height={h}
                        labels={aiResult.charts.distribution!.labels}
                        data={aiResult.charts.distribution!.data}
                        centerLabel={aiResult.charts.distribution!.data.reduce((a, b) => a + b, 0).toLocaleString("id")}
                      />
                    ),
                  }}
                >
                  <DoughnutChart
                    height={240}
                    labels={aiResult.charts.distribution.labels}
                    data={aiResult.charts.distribution.data}
                    centerLabel={aiResult.charts.distribution.data.reduce((a, b) => a + b, 0).toLocaleString("id")}
                  />
                </ChartFrame>
              ) : (
                <ChartFrame
                  id="chart-channel-mix"
                  name="Channel Mix"
                  category="Distribution"
                  subtitle="Komposisi sumber traffic"
                  source="Demo dataset"
                  detail={{
                    chartKind: "doughnut",
                    columnsUsed: [
                      { name: "channel", role: "label kategori" },
                      { name: "share %", role: "nilai per channel" },
                    ],
                    renderChart: (h) => (
                      <DoughnutChart
                        height={h}
                        labels={["Direct", "SEO", "Ads", "Social"]}
                        data={[42, 25, 22, 11]}
                        centerLabel="100%"
                      />
                    ),
                  }}
                >
                  <DoughnutChart
                    height={220}
                    labels={["Direct", "SEO", "Ads", "Social"]}
                    data={[42, 25, 22, 11]}
                    centerLabel="100%"
                  />
                </ChartFrame>
              )}

              {/* Scatter / Correlation */}
              {mode === "ai" && aiResult?.charts?.scatter ? (
                <ChartFrame
                  id="chart-scatter"
                  name={`${aiResult.charts.scatter.xLabel} × ${aiResult.charts.scatter.yLabel}`}
                  category="Correlation"
                  subtitle="Pola hubungan dua variabel numerik"
                  source={aiResult.fileName}
                  insight={aiResult.chartInsights?.["chart-scatter"]}
                  detail={{
                    chartKind: "scatter",
                    columnsUsed: [
                      { name: aiResult.charts.scatter.xLabel, role: "axis X (numerik)" },
                      { name: aiResult.charts.scatter.yLabel, role: "axis Y (numerik)" },
                    ],
                    renderChart: (h) => (
                      <ScatterChart
                        height={h}
                        series={[{ label: "Data points", data: aiResult.charts.scatter!.points }]}
                      />
                    ),
                  }}
                >
                  <ScatterChart
                    height={240}
                    series={[{ label: "Data points", data: aiResult.charts.scatter.points }]}
                  />
                </ChartFrame>
              ) : (
                <ChartFrame
                  id="chart-price-conversion"
                  name="Price × Conversion"
                  category="Correlation"
                  subtitle="Sensitivitas harga terhadap konversi"
                  source="Demo dataset"
                  detail={{
                    chartKind: "scatter",
                    columnsUsed: [
                      { name: "price", role: "axis X (harga)" },
                      { name: "conversion_rate", role: "axis Y (% konversi)" },
                      { name: "product", role: "legend (grup warna)" },
                    ],
                    renderChart: (h) => (
                      <ScatterChart
                        height={h}
                        series={[
                          { label: "Produk A", data: [{ x: 50, y: 4.2 }, { x: 80, y: 3.8 }, { x: 100, y: 3.4 }, { x: 120, y: 2.8 }, { x: 150, y: 2.4 }, { x: 180, y: 2.0 }] },
                          { label: "Produk B", data: [{ x: 60, y: 3.6 }, { x: 90, y: 3.2 }, { x: 110, y: 2.9 }, { x: 140, y: 2.5 }, { x: 170, y: 2.1 }] },
                        ]}
                      />
                    ),
                  }}
                >
                  <ScatterChart
                    height={240}
                    series={[
                      { label: "Produk A", data: [{ x: 50, y: 4.2 }, { x: 80, y: 3.8 }, { x: 100, y: 3.4 }, { x: 120, y: 2.8 }, { x: 150, y: 2.4 }, { x: 180, y: 2.0 }] },
                      { label: "Produk B", data: [{ x: 60, y: 3.6 }, { x: 90, y: 3.2 }, { x: 110, y: 2.9 }, { x: 140, y: 2.5 }, { x: 170, y: 2.1 }] },
                    ]}
                  />
                </ChartFrame>
              )}

              {/* Stacked or fallback to radar */}
              {mode === "ai" && aiResult?.charts?.stacked ? (
                <ChartFrame
                  id="chart-stacked"
                  name={`${aiResult.charts.stacked.series.map((s) => s.label).join(" + ")} per ${aiResult.analysis.primaryCategoryCol}`}
                  category="Stacked Composition"
                  subtitle="Komposisi metrik per kategori"
                  source={aiResult.fileName}
                  insight={aiResult.chartInsights?.["chart-stacked"]}
                  className="md:col-span-2"
                  detail={{
                    chartKind: "bar-stacked",
                    columnsUsed: [
                      {
                        name: aiResult.analysis.primaryCategoryCol ?? "kategori",
                        role: "axis X (kategori)",
                      },
                      ...aiResult.charts.stacked.series.map((s) => ({
                        name: s.label,
                        role: "axis Y (stack segment)",
                      })),
                    ],
                    renderChart: (h) => (
                      <BarChart
                        stacked
                        height={h}
                        labels={aiResult.charts.stacked!.labels}
                        series={aiResult.charts.stacked!.series}
                      />
                    ),
                  }}
                >
                  <BarChart
                    stacked
                    height={260}
                    labels={aiResult.charts.stacked.labels}
                    series={aiResult.charts.stacked.series}
                  />
                </ChartFrame>
              ) : (
                <>
                  <ChartFrame
                    id="chart-performance-radar"
                    name="Performance Radar"
                    category="Multi-metric"
                    subtitle="Perbandingan brand di 6 dimensi"
                    source="Demo dataset"
                    detail={{
                      chartKind: "radar",
                      columnsUsed: [
                        { name: "dimension", role: "axis radial (label)" },
                        { name: "score per brand", role: "nilai 0-10 per dimension" },
                      ],
                      renderChart: (h) => (
                        <RadarChart
                          height={h}
                          labels={["Speed", "Quality", "Price", "Support", "Reach", "UX"]}
                          series={[
                            { label: "Brand A", data: [9, 8, 7, 9, 8, 9] },
                            { label: "Brand B", data: [6, 7, 9, 6, 7, 6] },
                          ]}
                        />
                      ),
                    }}
                  >
                    <RadarChart
                      height={240}
                      labels={["Speed", "Quality", "Price", "Support", "Reach", "UX"]}
                      series={[
                        { label: "Brand A", data: [9, 8, 7, 9, 8, 9] },
                        { label: "Brand B", data: [6, 7, 9, 6, 7, 6] },
                      ]}
                    />
                  </ChartFrame>
                  <ChartFrame
                    id="chart-forecast-vs-actual"
                    name="Forecast vs Actual"
                    category="Mixed · Forecast"
                    subtitle="Aktual (bar) vs proyeksi (line)"
                    source="Demo dataset"
                    detail={{
                      chartKind: "mixed",
                      columnsUsed: [
                        { name: "month", role: "axis X (kategori waktu)" },
                        { name: "actual_sales", role: "axis Y bar (nilai)" },
                        { name: "forecast", role: "axis Y line (proyeksi)" },
                      ],
                      renderChart: (h) => (
                        <MixedChart
                          height={h}
                          labels={monthsRange}
                          bars={[{ label: "Aktual", data: demoSales, color: "#00D4FF" }]}
                          lines={[{ label: "Forecast", data: demoTarget, color: "#7B5EA7" }]}
                        />
                      ),
                    }}
                  >
                    <MixedChart
                      height={220}
                      labels={monthsRange}
                      bars={[{ label: "Aktual", data: demoSales, color: "#00D4FF" }]}
                      lines={[{ label: "Forecast", data: demoTarget, color: "#7B5EA7" }]}
                    />
                  </ChartFrame>
                </>
              )}

              {/* Detail tren kolom numerik pertama — hanya AI */}
              {mode === "ai" && aiResult && aiResult.charts.primary.series.length > 0 && (
                <ChartFrame
                  id="chart-trend-detail"
                  name={`Tren ${aiResult.charts.primary.series[0].label}`}
                  category="Trend Detail"
                  subtitle="Detail seri utama dalam line area"
                  source={aiResult.fileName}
                  insight={aiResult.chartInsights?.["chart-trend-detail"]}
                  detail={{
                    chartKind: "area",
                    columnsUsed: [
                      {
                        name:
                          aiResult.analysis.primaryDateCol ??
                          aiResult.analysis.primaryCategoryCol ??
                          "kategori",
                        role: "axis X",
                      },
                      {
                        name: aiResult.charts.primary.series[0].label,
                        role: "axis Y (nilai numerik)",
                      },
                    ],
                    renderChart: (h) => (
                      <LineAreaChart
                        height={h}
                        labels={aiResult.charts.primary.labels}
                        series={[aiResult.charts.primary.series[0]]}
                      />
                    ),
                  }}
                >
                  <LineAreaChart
                    height={240}
                    labels={aiResult.charts.primary.labels}
                    series={[aiResult.charts.primary.series[0]]}
                  />
                </ChartFrame>
              )}

              {/* Demo-mode-only extras */}
              {mode === "demo" && (
                <>
                  <ChartFrame
                    id="chart-region-share"
                    name="Region Share"
                    category="Polar Area"
                    subtitle="Proporsi penjualan per kota"
                    source="Demo dataset"
                    detail={{
                      chartKind: "polar",
                      columnsUsed: [
                        { name: "city", role: "label kategori" },
                        { name: "share %", role: "panjang area radial" },
                      ],
                      renderChart: (h) => (
                        <PolarChart
                          height={h}
                          labels={["Jakarta", "Bandung", "Surabaya", "Medan", "Bali"]}
                          data={[42, 18, 22, 10, 8]}
                        />
                      ),
                    }}
                  >
                    <PolarChart
                      height={240}
                      labels={["Jakarta", "Bandung", "Surabaya", "Medan", "Bali"]}
                      data={[42, 18, 22, 10, 8]}
                    />
                  </ChartFrame>
                  <ChartFrame
                    id="chart-customer-cluster"
                    name="Customer Cluster"
                    category="Segments · Bubble"
                    subtitle="Klaster pelanggan berdasarkan value"
                    source="Demo dataset"
                    detail={{
                      chartKind: "bubble",
                      columnsUsed: [
                        { name: "recency", role: "axis X" },
                        { name: "frequency", role: "axis Y" },
                        { name: "monetary", role: "ukuran bubble (size)" },
                        { name: "segment", role: "legend (grup warna)" },
                      ],
                      renderChart: (h) => (
                        <BubbleChart
                          height={h}
                          series={[
                            { label: "High value", data: [{ x: 30, y: 80, r: 18 }, { x: 45, y: 75, r: 22 }, { x: 60, y: 90, r: 16 }] },
                            { label: "Mid", data: [{ x: 25, y: 50, r: 12 }, { x: 40, y: 55, r: 14 }, { x: 55, y: 60, r: 10 }, { x: 70, y: 50, r: 16 }] },
                            { label: "Low", data: [{ x: 15, y: 25, r: 8 }, { x: 30, y: 20, r: 10 }, { x: 45, y: 30, r: 9 }, { x: 60, y: 22, r: 7 }] },
                          ]}
                        />
                      ),
                    }}
                  >
                    <BubbleChart
                      height={240}
                      series={[
                        { label: "High value", data: [{ x: 30, y: 80, r: 18 }, { x: 45, y: 75, r: 22 }, { x: 60, y: 90, r: 16 }] },
                        { label: "Mid", data: [{ x: 25, y: 50, r: 12 }, { x: 40, y: 55, r: 14 }, { x: 55, y: 60, r: 10 }, { x: 70, y: 50, r: 16 }] },
                        { label: "Low", data: [{ x: 15, y: 25, r: 8 }, { x: 30, y: 20, r: 10 }, { x: 45, y: 30, r: 9 }, { x: 60, y: 22, r: 7 }] },
                      ]}
                    />
                  </ChartFrame>
                  <ChartFrame
                    id="chart-revenue-by-segment"
                    name="Revenue by Segment"
                    category="Stacked Bar"
                    subtitle="Breakdown revenue per tier customer"
                    source="Demo dataset"
                    className="md:col-span-2"
                    detail={{
                      chartKind: "bar-stacked",
                      columnsUsed: [
                        { name: "month", role: "axis X (kategori waktu)" },
                        { name: "revenue per tier (Enterprise/SMB/Startup)", role: "axis Y stack segments" },
                      ],
                      renderChart: (h) => (
                        <BarChart
                          height={h}
                          stacked
                          labels={monthsRange}
                          series={[
                            { label: "Enterprise", data: demoSales.map((s) => Math.round(s * 0.5)), color: "#00D4FF" },
                            { label: "SMB", data: demoSales.map((s) => Math.round(s * 0.3)), color: "#7B5EA7" },
                            { label: "Startup", data: demoSales.map((s) => Math.round(s * 0.2)), color: "#00FFB3" },
                          ]}
                        />
                      ),
                    }}
                  >
                    <BarChart
                      height={240}
                      stacked
                      labels={monthsRange}
                      series={[
                        { label: "Enterprise", data: demoSales.map((s) => Math.round(s * 0.5)), color: "#00D4FF" },
                        { label: "SMB", data: demoSales.map((s) => Math.round(s * 0.3)), color: "#7B5EA7" },
                        { label: "Startup", data: demoSales.map((s) => Math.round(s * 0.2)), color: "#00FFB3" },
                      ]}
                    />
                  </ChartFrame>
                  <ChartFrame
                    id="chart-activity-heatmap"
                    name="Activity by Day × Hour"
                    category="Heatmap"
                    subtitle="Kepadatan aktivitas per hari & jam"
                    source="Demo dataset"
                    detail={{
                      chartKind: "heatmap",
                      columnsUsed: [
                        { name: "day_of_week", role: "axis Y (baris)" },
                        { name: "hour", role: "axis X (kolom)" },
                        { name: "activity_count", role: "intensitas warna sel" },
                      ],
                      renderChart: (h) => (
                        <Heatmap
                          height={h}
                          rows={["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]}
                          cols={["08", "10", "12", "14", "16", "18", "20"]}
                          values={[
                            [12, 18, 24, 31, 28, 22, 14],
                            [16, 24, 30, 38, 34, 26, 18],
                            [18, 28, 35, 42, 38, 30, 20],
                            [20, 30, 38, 45, 40, 32, 22],
                            [25, 36, 44, 52, 48, 38, 28],
                            [10, 14, 18, 22, 26, 30, 24],
                            [8, 10, 14, 18, 22, 26, 20],
                          ]}
                        />
                      ),
                    }}
                  >
                    <Heatmap
                      height={240}
                      rows={["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]}
                      cols={["08", "10", "12", "14", "16", "18", "20"]}
                      values={[
                        [12, 18, 24, 31, 28, 22, 14],
                        [16, 24, 30, 38, 34, 26, 18],
                        [18, 28, 35, 42, 38, 30, 20],
                        [20, 30, 38, 45, 40, 32, 22],
                        [25, 36, 44, 52, 48, 38, 28],
                        [10, 14, 18, 22, 26, 30, 24],
                        [8, 10, 14, 18, 22, 26, 20],
                      ]}
                    />
                  </ChartFrame>
                </>
              )}
            </div>

            {/* ANOMALIES detail in AI mode */}
            {mode === "ai" && aiResult && aiResult.analysis.anomalies.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <h4 className="font-syne font-semibold text-white text-sm">
                    Outliers Terdeteksi (Z-score ≥ 2.5)
                  </h4>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {aiResult.analysis.anomalies.map((a, i) => (
                    <div key={i} className="rounded-lg border border-borderColor bg-bgSurface/60 p-3">
                      <p className="font-syne text-white text-sm mb-1">{a.column}</p>
                      <p className="text-xs text-muted">
                        {a.count} outlier · Z-max{" "}
                        <span className="font-mono text-warning">
                          {a.topExample?.zscore.toFixed(2)}
                        </span>
                        {a.topExample && (
                          <>
                            {" "}@ baris{" "}
                            <span className="font-mono text-white">#{a.topExample.rowIndex + 1}</span>
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* DATA PREVIEW — scrollable horizontal, semua kolom (match wizard style) */}
            <Card>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan">Raw Data</p>
                  <h4 className="font-syne font-semibold text-white text-sm">
                    Preview ({showFullPreview && mode === "ai" && aiResult
                      ? Math.min(aiResult.tableSnapshot.rows.length, 100)
                      : mode === "ai" && aiResult
                        ? aiResult.charts.preview.rows.length
                        : monthsRange.length} baris)
                    {mode === "ai" && aiResult && (
                      <span className="text-muted text-xs ml-2 font-normal">
                        dari {aiResult.rowCount.toLocaleString("id")} total
                      </span>
                    )}
                  </h4>
                </div>
                {mode === "ai" && aiResult && aiResult.tableSnapshot.rows.length > 10 && (
                  <button
                    onClick={() => setShowFullPreview(!showFullPreview)}
                    className="text-xs text-cyan hover:underline flex items-center gap-1"
                  >
                    {showFullPreview ? "Tampilkan 10 baris saja" : `Lihat sampai 100 baris`}{" "}
                    <FileText className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-md border border-borderColor">
                {mode === "ai" && aiResult ? (
                  <table className="text-xs" style={{ minWidth: "max-content" }}>
                    <thead className="sticky top-0">
                      <tr className="bg-bgSurface text-left border-b border-borderColor">
                        <th className="py-2 px-3 text-muted font-mono text-[10px] uppercase tracking-wider sticky left-0 bg-bgSurface z-10 border-r border-borderColor">
                          #
                        </th>
                        {aiResult.charts.preview.headers.map((h) => (
                          <th
                            key={h}
                            className="py-2 px-3 text-muted font-mono uppercase tracking-wider whitespace-nowrap"
                            title={h}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(showFullPreview
                        ? aiResult.tableSnapshot.rows
                            .slice(0, 100)
                            .map((r) => aiResult.charts.preview.headers.map((h) => r[h] ?? null))
                        : aiResult.charts.preview.rows
                      ).map((row, i) => (
                        <tr key={i} className="border-b border-borderColor/40 last:border-0 hover:bg-bgElevated/40">
                          <td className="py-2 px-3 text-muted font-mono text-[10px] sticky left-0 bg-bgDeep z-10 border-r border-borderColor">
                            {i + 1}
                          </td>
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="py-2 px-3 text-white font-mono whitespace-nowrap max-w-[280px] truncate"
                              title={cell === null || cell === undefined || cell === "" ? "kosong" : String(cell)}
                            >
                              {cell === null || cell === undefined || cell === "" ? (
                                <span className="text-muted">—</span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-borderColor bg-bgSurface">
                        <th className="py-3 px-3">Bulan</th>
                        <th className="py-3 px-3 text-right">Penjualan</th>
                        <th className="py-3 px-3 text-right">Target</th>
                        <th className="py-3 px-3 text-right">Profit</th>
                        <th className="py-3 px-3 text-right">% Target</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {monthsRange.map((m, i) => {
                        const pct = (demoSales[i] / demoTarget[i]) * 100;
                        const positive = pct >= 100;
                        return (
                          <tr key={m} className="border-b border-borderColor/40 last:border-0 hover:bg-bgElevated/40">
                            <td className="py-3 px-3">{m}</td>
                            <td className="py-3 px-3 text-right font-mono">{demoSales[i].toLocaleString("id")}</td>
                            <td className="py-3 px-3 text-right font-mono text-muted">{demoTarget[i].toLocaleString("id")}</td>
                            <td className="py-3 px-3 text-right font-mono">{demoProfit[i].toLocaleString("id")}</td>
                            <td className={`py-3 px-3 text-right font-mono ${positive ? "text-mint" : "text-danger"}`}>
                              {pct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {mode === "ai" && aiResult && (
                <p className="text-[10px] text-muted mt-2">
                  Scroll ke kanan untuk lihat semua {aiResult.charts.preview.headers.length} kolom →
                </p>
              )}
            </Card>

            {/* ACTION BAR */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={generatePdf} disabled={pdfLoading || mode !== "ai"}>
                {pdfLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    {mode === "ai" ? "Download PDF Report" : "PDF Report (perlu analisis)"}
                  </>
                )}
              </Button>

              {/* Save Project button */}
              {mode === "ai" && (
                <button
                  onClick={onSaveProject}
                  disabled={saveState === "saving" || saveState === "saved"}
                  className={`px-4 py-2.5 rounded-md border text-sm flex items-center gap-2 transition-all font-medium ${
                    saveState === "saved"
                      ? "border-mint/40 bg-mint/10 text-mint"
                      : saveState === "error"
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-purple/40 bg-purple/10 text-purple hover:bg-purple/20"
                  }`}
                  title={saveError ?? undefined}
                >
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="w-4 h-4" /> Tersimpan
                    </>
                  ) : saveState === "error" ? (
                    <>
                      <AlertTriangle className="w-4 h-4" /> Gagal save
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Project
                    </>
                  )}
                </button>
              )}

              {saveState === "saved" && savedProjectId && (
                <Link
                  href={`/projects/${savedProjectId}`}
                  className="px-4 py-2.5 rounded-md border border-mint/40 bg-mint/10 text-mint text-sm flex items-center gap-2 hover:bg-mint/20 transition-all"
                >
                  <FolderOpen className="w-4 h-4" /> Buka project
                </Link>
              )}

              <button
                onClick={onShare}
                className="ml-auto px-4 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-2"
              >
                {shareCopied ? <Check className="w-4 h-4 text-mint" /> : <Share2 className="w-4 h-4" />}
                {shareCopied ? "Link disalin" : "Share"}
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="px-4 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-2"
                aria-label="Copy link"
              >
                <Copy className="w-4 h-4" /> Salin Link
              </button>
            </div>
            {saveError && saveState === "error" && (
              <p className="text-xs text-danger -mt-2">{saveError}</p>
            )}
          </div>
        )}
      </div>

      {/* Toast notifications (replaces native alert()) */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-lg shadow-glow border flex items-start gap-2.5 backdrop-blur-xl animate-fadeUp ${
            toast.type === "success"
              ? "bg-mint/15 border-mint/40 text-mint"
              : toast.type === "error"
                ? "bg-danger/15 border-danger/40 text-danger"
                : "bg-cyan/15 border-cyan/40 text-cyan"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : toast.type === "error" ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-white leading-relaxed flex-1">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Footer />
    </main>
  );
}

function CorrHeatmap({ matrix }: { matrix: { columns: string[]; matrix: number[][] } }) {
  const { columns, matrix: m } = matrix;
  const cellColor = (r: number) => {
    const a = Math.abs(r);
    if (r >= 0) {
      // cyan for positive
      return `rgba(0, 212, 255, ${0.1 + a * 0.85})`;
    }
    return `rgba(255, 77, 109, ${0.1 + a * 0.85})`;
  };

  return (
    <div className="overflow-auto">
      <div
        className="grid gap-1 min-w-full"
        style={{
          gridTemplateColumns: `minmax(120px, auto) repeat(${columns.length}, minmax(56px, 1fr))`,
        }}
      >
        <div />
        {columns.map((c) => (
          <div key={`h-${c}`} className="text-[10px] text-muted text-center pb-1 truncate" title={c}>
            {c.length > 9 ? c.slice(0, 8) + "…" : c}
          </div>
        ))}
        {columns.map((row, i) => (
          <Fragment key={`r-${row}`}>
            <div className="text-[10px] text-muted pr-2 flex items-center justify-end truncate" title={row}>
              {row.length > 14 ? row.slice(0, 13) + "…" : row}
            </div>
            {columns.map((col, j) => {
              const r = m[i]?.[j] ?? 0;
              const isDiag = i === j;
              return (
                <div
                  key={`c-${i}-${j}`}
                  className="aspect-square rounded flex items-center justify-center text-[10px] font-mono transition-transform hover:scale-110 hover:z-10 hover:ring-2 hover:ring-cyan/60"
                  style={{
                    background: isDiag ? "rgba(255,255,255,0.06)" : cellColor(r),
                    color: Math.abs(r) > 0.5 ? "#ffffff" : "rgba(255,255,255,0.7)",
                  }}
                  title={`${row} × ${col}: r = ${r.toFixed(3)}`}
                >
                  {r.toFixed(2)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function typeColor(t: string): string {
  switch (t) {
    case "number":
    case "integer":
    case "currency":
    case "percent":
      return "bg-cyan/15 text-cyan border border-cyan/30";
    case "date":
      return "bg-purple/15 text-purple border border-purple/30";
    case "categorical":
      return "bg-mint/15 text-mint border border-mint/30";
    case "boolean":
      return "bg-warning/15 text-warning border border-warning/30";
    default:
      return "bg-bgElevated text-muted border border-borderColor";
  }
}
