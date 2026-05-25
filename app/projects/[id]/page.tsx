"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AiAssistant from "@/components/ui/AiAssistant";
import InsightPanel from "@/components/ui/InsightPanel";
import KpiCard from "@/components/ui/charts/KpiCard";
import ChartSwitcher from "@/components/ui/charts/ChartSwitcher";
import ChartFrame from "@/components/ui/charts/ChartFrame";
import BarChart from "@/components/ui/charts/BarChart";
import DoughnutChart from "@/components/ui/charts/DoughnutChart";
import ScatterChart from "@/components/ui/charts/ScatterChart";
import LineAreaChart from "@/components/ui/charts/LineAreaChart";
import { getProject, deleteProject } from "@/lib/db/projects";
import type { ProjectRow } from "@/lib/db/types";
import type { EngineResult } from "@/lib/engine";
import {
  ArrowLeft, Calendar, Cpu, Database, Heart, Lightbulb, MessageSquare,
  AlertTriangle, FileText, Loader2, Trash2, Sparkles, RefreshCw,
} from "lucide-react";

const SPARK_COLORS = ["#00D4FF", "#00FFB3", "#FF6FB5", "#7B5EA7"];

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params!.id[0] : "";

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getProject(id)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setError("Project tidak ditemukan atau kamu tidak punya akses.");
        } else {
          setProject(p);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal load project");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Reconstruct EngineResult from snapshot for downstream components
  const result = project?.snapshot as EngineResult | undefined;

  const primaryChart = useMemo(() => {
    if (!result?.charts?.primary?.series?.length) return null;
    return {
      labels: result.charts.primary.labels,
      series: result.charts.primary.series,
      title: result.analysis?.primaryDateCol
        ? `Tren Time-Series — ${result.charts.primary.series.map((s) => s.label).join(", ")}`
        : result.analysis?.primaryCategoryCol
          ? `${result.charts.primary.series[0].label} per ${result.analysis.primaryCategoryCol}`
          : "Data Series",
    };
  }, [result]);

  const kpiCards = useMemo(() => {
    if (!result?.kpis?.length) return [];
    const thumb = Array.isArray(project?.thumbnail)
      ? (project!.thumbnail.filter((v) => typeof v === "number") as number[])
      : [];
    return result.kpis.slice(0, 4).map((k, i) => ({
      ...k,
      spark: thumb.length >= 3
        ? thumb
        : Array.from({ length: 8 }, (_, j) =>
            20 + Math.round(Math.sin(i + j / 2) * 15 + j * (k.change >= 0 ? 2 : -1.2)),
          ),
      color: SPARK_COLORS[i % SPARK_COLORS.length],
    }));
  }, [result, project]);

  const onDelete = async () => {
    if (!project) return;
    if (!confirm("Hapus project ini? Tidak bisa dibatalkan.")) return;
    const res = await deleteProject(project.id);
    if (!res.ok) {
      alert(res.error ?? "Gagal hapus");
      return;
    }
    router.push("/projects");
  };

  const onUpdate = () => {
    if (!project) return;
    // Redirect ke dashboard dengan ?update=<id> — dashboard akan deteksi
    // dan jalankan flow re-analyze (upload file ulang → wizard → save sebagai UPDATE).
    router.push(`/dashboard?update=${project.id}`);
  };

  const onExportPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      const { downloadReport } = await import("@/lib/report/pdf");
      await downloadReport(result);
    } catch (err) {
      alert("Gagal generate PDF: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* BREADCRUMB */}
        <div className="mb-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-cyan transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Project History
          </Link>
        </div>

        {loading && (
          <div className="glass rounded-2xl p-16 text-center">
            <Loader2 className="w-10 h-10 text-cyan animate-spin mx-auto mb-3" />
            <p className="text-muted">Memuat snapshot project…</p>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl p-10 text-center">
            <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
            <p className="text-white font-syne font-bold mb-2">{error}</p>
            <Link href="/projects">
              <Button variant="ghost">Kembali ke list</Button>
            </Link>
          </div>
        )}

        {project && result && (
          <>
            {/* HEADER */}
            <div className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan/10 blur-3xl rounded-full pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="text-5xl flex-shrink-0">{project.domain_emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan mb-1">
                      {project.domain_name} · Project Snapshot
                    </p>
                    <h1 className="text-2xl md:text-3xl font-syne font-bold text-white mb-1 truncate">
                      {project.name}
                    </h1>
                    <p className="text-xs text-muted font-mono truncate" title={project.file_name}>
                      {project.file_name} · {project.row_count.toLocaleString("id")} baris × {project.column_count} kolom
                    </p>
                    <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Disimpan {new Date(project.created_at).toLocaleString("id", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {project.updated_at && project.updated_at !== project.created_at && (
                        <>
                          {" "} · diperbarui{" "}
                          {new Date(project.updated_at).toLocaleString("id", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={onUpdate}
                    className="px-3 py-2 rounded-md border border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20 text-sm flex items-center gap-2 transition-colors font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Update Project
                  </button>
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm">
                      <Sparkles className="w-3.5 h-3.5" /> Analisis Baru
                    </Button>
                  </Link>
                  {/* PDF Report di-nonaktifkan sementara — desain sedang direvisi.
                      onExportPdf handler tetap ada supaya gampang re-enable nanti. */}
                  <button
                    disabled
                    title="Fitur sedang direvisi — desain belum layak digunakan"
                    className="px-3 py-2 rounded-md border border-borderColor text-muted text-sm flex items-center gap-2 opacity-60 cursor-not-allowed"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF Report (under development)
                  </button>
                  <button
                    onClick={onDelete}
                    className="px-3 py-2 rounded-md border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 text-sm flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </div>

            {/* AI SUMMARY BANNER */}
            {project.summary && (
              <div className="glass rounded-2xl p-5 mb-6 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan/15 blur-3xl rounded-full pointer-events-none" />
                <div className="relative flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-cyan" />
                  </div>
                  <div className="flex-1">
                    <p className="font-syne font-bold text-white mb-1.5">Ringkasan Eksekutif</p>
                    <p className="text-sm text-white leading-relaxed">{project.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* CONCLUSION + USER CONTEXT */}
            {(project.conclusion || result.userContext) && (
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {project.conclusion && (
                  <div className={`glass rounded-2xl p-5 relative overflow-hidden ${result.userContext ? "md:col-span-2" : "md:col-span-3"} border border-purple/20 bg-gradient-to-br from-purple/8 to-transparent`}>
                    <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-purple/15 blur-3xl rounded-full pointer-events-none" />
                    <div className="relative flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-5 h-5 text-purple" />
                      </div>
                      <div className="flex-1">
                        <p className="font-syne font-bold text-white mb-1.5">Kesimpulan Grafio</p>
                        <p className="text-sm text-white leading-relaxed italic">
                          {project.conclusion}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {result.userContext && (
                  <div className="glass rounded-2xl p-5 border border-mint/20 bg-gradient-to-br from-mint/8 to-transparent">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-mint" />
                      <p className="font-syne font-bold text-white text-sm">Konteks Dari Kamu</p>
                    </div>
                    <p className="text-xs text-white leading-relaxed italic">
                      &ldquo;{result.userContext}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* COLUMN PROFILE */}
            {result.profile && result.profile.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan" />
                    <h3 className="font-syne font-semibold text-white text-sm">Profil Kolom Terdeteksi</h3>
                  </div>
                  <span className="text-[10px] text-muted">{result.profile.length} kolom</span>
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
                        <th className="py-2 pr-4 text-right">Outlier</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {result.profile.slice(0, 12).map((p) => (
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
                          <td className={`py-2 pr-4 text-right font-mono ${(p.outlierCount ?? 0) > 0 ? "text-warning" : "text-muted"}`}>
                            {p.outlierCount ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* KPI CARDS */}
            {kpiCards.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                {kpiCards.map((k, i) => (
                  <KpiCard key={i} {...k} />
                ))}
              </div>
            )}

            {/* MAIN CHART + AI ASSISTANT */}
            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                {primaryChart && (
                  <ChartFrame
                    id="chart-primary"
                    name={primaryChart.title}
                    category="Chart Utama · From Snapshot"
                    subtitle={`${primaryChart.series.length} seri data · ${primaryChart.labels.length} titik`}
                    source={project.file_name}
                    insight={result.chartInsights?.["chart-primary"]}
                    detail={{
                      chartKind: "line",
                      columnsUsed: [
                        {
                          name: result.analysis?.primaryDateCol ?? result.analysis?.primaryCategoryCol ?? "axis X",
                          role: "axis X (kategori/waktu)",
                        },
                        ...primaryChart.series.map((s) => ({
                          name: s.label,
                          role: "axis Y (nilai numerik)",
                        })),
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
                )}
              </div>
              <div>
                <AiAssistant context={result} />
              </div>
            </div>

            {/* INSIGHTS */}
            {result.insights && result.insights.length > 0 && (
              <div className="mb-6">
                <InsightPanel insights={result.insights} />
              </div>
            )}

            {/* CORRELATION MATRIX */}
            {result.analysis?.correlationMatrix && (
              <div className="mb-6">
                <ChartFrame
                  id="chart-correlation-matrix"
                  name="Matriks Korelasi Pearson"
                  category="Correlation Matrix"
                  subtitle={`Pearson r untuk ${result.analysis.correlationMatrix.columns.length} kolom numerik · biru = positif, merah = negatif`}
                  source={project.file_name}
                  insight={result.chartInsights?.["chart-correlation-matrix"]}
                  detail={{
                    chartKind: "heatmap",
                    columnsUsed: result.analysis.correlationMatrix.columns.map((c) => ({
                      name: c,
                      role: "axis kolom & baris matriks",
                    })),
                    renderChart: () => <CorrHeatmap matrix={result.analysis.correlationMatrix!} full />,
                  }}
                >
                  <CorrHeatmap matrix={result.analysis.correlationMatrix} />
                </ChartFrame>
              </div>
            )}

            {/* TOP CORRELATIONS */}
            {result.analysis && result.analysis.correlations.length > 0 && (
              <Card className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan">Pearson Correlation</p>
                    <h4 className="font-syne font-semibold text-white text-sm">
                      Top {result.analysis.correlations.length} pasangan kolom
                    </h4>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.analysis.correlations.map((c, i) => {
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

            {/* CHART GRID */}
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-5 mb-6">
              {result.charts?.distribution && (
                <ChartFrame
                  id="chart-distribution"
                  name={`Distribusi ${result.analysis?.primaryCategoryCol ?? "Kategori"}`}
                  category="Distribution"
                  subtitle={`${result.charts.distribution.labels.length} kategori unik`}
                  source={project.file_name}
                  insight={result.chartInsights?.["chart-distribution"]}
                  detail={{
                    chartKind: "doughnut",
                    columnsUsed: [
                      { name: result.analysis?.primaryCategoryCol ?? "kategori", role: "label kategori" },
                      { name: "(count)", role: "nilai per slice" },
                    ],
                    renderChart: (h) => (
                      <DoughnutChart
                        height={h}
                        labels={result.charts.distribution!.labels}
                        data={result.charts.distribution!.data}
                        centerLabel={result.charts.distribution!.data.reduce((a, b) => a + b, 0).toLocaleString("id")}
                      />
                    ),
                  }}
                >
                  <DoughnutChart
                    height={240}
                    labels={result.charts.distribution.labels}
                    data={result.charts.distribution.data}
                    centerLabel={result.charts.distribution.data.reduce((a, b) => a + b, 0).toLocaleString("id")}
                  />
                </ChartFrame>
              )}

              {result.charts?.scatter && (
                <ChartFrame
                  id="chart-scatter"
                  name={`${result.charts.scatter.xLabel} × ${result.charts.scatter.yLabel}`}
                  category="Correlation"
                  subtitle="Pola hubungan dua variabel numerik"
                  source={project.file_name}
                  insight={result.chartInsights?.["chart-scatter"]}
                  detail={{
                    chartKind: "scatter",
                    columnsUsed: [
                      { name: result.charts.scatter.xLabel, role: "axis X (numerik)" },
                      { name: result.charts.scatter.yLabel, role: "axis Y (numerik)" },
                    ],
                    renderChart: (h) => (
                      <ScatterChart
                        height={h}
                        series={[{ label: "Data points", data: result.charts.scatter!.points }]}
                      />
                    ),
                  }}
                >
                  <ScatterChart
                    height={240}
                    series={[{ label: "Data points", data: result.charts.scatter.points }]}
                  />
                </ChartFrame>
              )}

              {result.charts?.stacked && (
                <ChartFrame
                  id="chart-stacked"
                  name={`${result.charts.stacked.series.map((s) => s.label).join(" + ")} per ${result.analysis?.primaryCategoryCol}`}
                  category="Stacked Composition"
                  subtitle="Komposisi metrik per kategori"
                  source={project.file_name}
                  insight={result.chartInsights?.["chart-stacked"]}
                  className="md:col-span-2"
                  detail={{
                    chartKind: "bar-stacked",
                    columnsUsed: [
                      { name: result.analysis?.primaryCategoryCol ?? "kategori", role: "axis X (kategori)" },
                      ...result.charts.stacked.series.map((s) => ({ name: s.label, role: "axis Y (stack)" })),
                    ],
                    renderChart: (h) => (
                      <BarChart
                        stacked
                        height={h}
                        labels={result.charts.stacked!.labels}
                        series={result.charts.stacked!.series}
                      />
                    ),
                  }}
                >
                  <BarChart
                    stacked
                    height={260}
                    labels={result.charts.stacked.labels}
                    series={result.charts.stacked.series}
                  />
                </ChartFrame>
              )}

              {result.charts?.primary?.series && result.charts.primary.series.length > 0 && (
                <ChartFrame
                  id="chart-trend-detail"
                  name={`Tren ${result.charts.primary.series[0].label}`}
                  category="Trend Detail"
                  subtitle="Detail seri utama dalam line area"
                  source={project.file_name}
                  insight={result.chartInsights?.["chart-trend-detail"]}
                  detail={{
                    chartKind: "area",
                    columnsUsed: [
                      {
                        name: result.analysis?.primaryDateCol ?? result.analysis?.primaryCategoryCol ?? "axis X",
                        role: "axis X",
                      },
                      { name: result.charts.primary.series[0].label, role: "axis Y (nilai numerik)" },
                    ],
                    renderChart: (h) => (
                      <LineAreaChart
                        height={h}
                        labels={result.charts.primary.labels}
                        series={[result.charts.primary.series[0]]}
                      />
                    ),
                  }}
                >
                  <LineAreaChart
                    height={240}
                    labels={result.charts.primary.labels}
                    series={[result.charts.primary.series[0]]}
                  />
                </ChartFrame>
              )}
            </div>

            {/* ANOMALIES */}
            {result.analysis && result.analysis.anomalies.length > 0 && (
              <Card className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <h4 className="font-syne font-semibold text-white text-sm">
                    Outliers Terdeteksi (Z-score ≥ 2.5)
                  </h4>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.analysis.anomalies.map((a, i) => (
                    <div key={i} className="rounded-lg border border-borderColor bg-bgSurface/60 p-3">
                      <p className="font-syne text-white text-sm mb-1">{a.column}</p>
                      <p className="text-xs text-muted">
                        {a.count} outlier · Z-max{" "}
                        <span className="font-mono text-warning">{a.topExample?.zscore.toFixed(2)}</span>
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

            {/* RAW DATA PREVIEW */}
            {result.tableSnapshot?.rows?.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan">Snapshot Data</p>
                    <h4 className="font-syne font-semibold text-white text-sm">
                      Preview ({Math.min(20, result.tableSnapshot.rows.length)} baris pertama)
                    </h4>
                  </div>
                  <span className="text-[10px] text-muted">
                    dari {project.row_count.toLocaleString("id")} total
                  </span>
                </div>
                <div className="overflow-x-auto rounded-md border border-borderColor">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-bgSurface text-left border-b border-borderColor">
                        {result.tableSnapshot.headers.slice(0, 10).map((h) => (
                          <th key={h} className="py-2 px-3 text-muted font-mono uppercase tracking-wider truncate">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.tableSnapshot.rows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-borderColor/40 last:border-0">
                          {result.tableSnapshot.headers.slice(0, 10).map((h, j) => (
                            <td key={j} className="py-2 px-3 text-white font-mono truncate max-w-[160px]">
                              {row[h] === null || row[h] === undefined ? (
                                <span className="text-muted">—</span>
                              ) : (
                                String(row[h])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}

// ============================================================
// CorrHeatmap (sama dengan dashboard — duplicate untuk decouple)
// ============================================================

function CorrHeatmap({
  matrix,
  full = false,
}: {
  matrix: { columns: string[]; matrix: number[][] };
  full?: boolean;
}) {
  const { columns, matrix: m } = matrix;
  const cellColor = (r: number) => {
    const a = Math.abs(r);
    if (r >= 0) return `rgba(0, 212, 255, ${0.1 + a * 0.85})`;
    return `rgba(255, 77, 109, ${0.1 + a * 0.85})`;
  };
  const headerMaxLen = full ? 18 : 9;
  const rowMaxLen = full ? 24 : 14;
  const minCell = full ? 76 : 56;
  const minRowLabel = full ? 180 : 120;
  const fontCls = full ? "text-xs" : "text-[10px]";

  return (
    <div className="overflow-auto">
      <div
        className="grid gap-1 min-w-full"
        style={{
          gridTemplateColumns: `minmax(${minRowLabel}px, auto) repeat(${columns.length}, minmax(${minCell}px, 1fr))`,
        }}
      >
        <div />
        {columns.map((c) => (
          <div key={`h-${c}`} className={`${fontCls} text-muted text-center pb-1 truncate`} title={c}>
            {c.length > headerMaxLen ? c.slice(0, headerMaxLen - 1) + "…" : c}
          </div>
        ))}
        {columns.map((row, i) => (
          <Fragment key={`r-${row}`}>
            <div className={`${fontCls} text-muted pr-2 flex items-center justify-end truncate`} title={row}>
              {row.length > rowMaxLen ? row.slice(0, rowMaxLen - 1) + "…" : row}
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
