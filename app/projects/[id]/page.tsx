"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AiAssistant from "@/components/ui/AiAssistant";
import ExplainButton from "@/components/ui/ExplainButton";
import KpiCard from "@/components/ui/charts/KpiCard";
import ChartSwitcher from "@/components/ui/charts/ChartSwitcher";
import DoughnutChart from "@/components/ui/charts/DoughnutChart";
import ScatterChart from "@/components/ui/charts/ScatterChart";
import InsightPanel from "@/components/ui/InsightPanel";
import { getProject, deleteProject } from "@/lib/db/projects";
import type { ProjectRow } from "@/lib/db/types";
import type { EngineResult } from "@/lib/engine";
import {
  ArrowLeft, Calendar, Cpu, Database, Heart, Lightbulb, MessageSquare,
  AlertTriangle, FileText, Loader2, Trash2, Sparkles, Pencil,
} from "lucide-react";

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
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm">
                      <Sparkles className="w-3.5 h-3.5" /> Analisis Baru
                    </Button>
                  </Link>
                  <button
                    onClick={onExportPdf}
                    disabled={pdfLoading}
                    className="px-3 py-2 rounded-md border border-borderColor text-white hover:border-cyan text-sm flex items-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {pdfLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    {pdfLoading ? "Generating…" : "PDF Report"}
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

            {/* SUMMARY CARD */}
            {project.summary && (
              <div className="glass rounded-2xl p-5 mb-6 relative overflow-hidden">
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

            {/* META STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MiniStat icon={Database} label="Total Baris" value={project.row_count.toLocaleString("id")} color="cyan" />
              <MiniStat icon={Database} label="Kolom" value={project.column_count.toString()} color="purple" />
              {project.health_score != null && (
                <MiniStat
                  icon={Heart}
                  label="Health Score"
                  value={`${project.health_score}/100`}
                  color={project.health_score >= 80 ? "mint" : project.health_score >= 60 ? "cyan" : "warning"}
                />
              )}
              <MiniStat
                icon={AlertTriangle}
                label="Outliers Terdeteksi"
                value={(result.analysis?.anomalies?.reduce((s, a) => s + a.count, 0) ?? 0).toString()}
                color="warning"
              />
            </div>

            {/* KPI CARDS */}
            {result.kpis && result.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {result.kpis.slice(0, 4).map((k, i) => {
                  const thumb = Array.isArray(project.thumbnail)
                    ? (project.thumbnail.filter((v) => typeof v === "number") as number[])
                    : [];
                  const spark = thumb.length >= 3 ? thumb : [20, 30, 28, 41, 38, 52, 60, 68];
                  return (
                    <KpiCard
                      key={i}
                      label={k.label}
                      value={k.value}
                      change={k.change}
                      spark={spark}
                      color={["#00D4FF", "#00FFB3", "#FF6FB5", "#7B5EA7"][i % 4]}
                    />
                  );
                })}
              </div>
            )}

            {/* MAIN CHART + AI ASSISTANT */}
            <div className="grid lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                {primaryChart && (
                  <Card>
                    <ExplainButton
                      chartType="Recommended Chart"
                      chartTitle={primaryChart.title}
                      chartDescription="Chart utama project snapshot"
                      labels={primaryChart.labels}
                      datasets={primaryChart.series.map((s) => ({ label: s.label, data: s.data }))}
                      domain={result.domain?.name}
                    />
                    <div className="mb-2">
                      <p className="text-xs uppercase tracking-widest text-cyan">From Snapshot</p>
                      <h3 className="font-syne font-bold text-white text-lg">{primaryChart.title}</h3>
                    </div>
                    <ChartSwitcher labels={primaryChart.labels} series={primaryChart.series} />
                  </Card>
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

            {/* DISTRIBUTION + SCATTER (if available) */}
            <div className="grid lg:grid-cols-2 gap-5 mb-6">
              {result.charts?.distribution && (
                <Card>
                  <p className="text-[10px] uppercase tracking-widest text-cyan">Distribution</p>
                  <h4 className="font-syne font-semibold text-white text-sm mb-3">
                    {result.analysis?.primaryCategoryCol ?? "Distribusi"}
                  </h4>
                  <DoughnutChart
                    height={240}
                    labels={result.charts.distribution.labels}
                    data={result.charts.distribution.data}
                    centerLabel={result.charts.distribution.data.reduce((a, b) => a + b, 0).toLocaleString("id")}
                  />
                </Card>
              )}
              {result.charts?.scatter && (
                <Card>
                  <p className="text-[10px] uppercase tracking-widest text-cyan">Correlation</p>
                  <h4 className="font-syne font-semibold text-white text-sm mb-3 truncate">
                    {result.charts.scatter.xLabel} × {result.charts.scatter.yLabel}
                  </h4>
                  <ScatterChart
                    height={240}
                    series={[{ label: "Data points", data: result.charts.scatter.points }]}
                  />
                </Card>
              )}
            </div>

            {/* RAW DATA PREVIEW */}
            {result.tableSnapshot?.rows?.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan">Snapshot Data</p>
                    <h4 className="font-syne font-semibold text-white text-sm">
                      Preview ({result.tableSnapshot.rows.length} baris pertama)
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

function MiniStat({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: "cyan" | "purple" | "mint" | "warning";
}) {
  const cls: Record<string, string> = {
    cyan: "border-cyan/30 bg-cyan/5 text-cyan",
    purple: "border-purple/30 bg-purple/5 text-purple",
    mint: "border-mint/30 bg-mint/5 text-mint",
    warning: "border-warning/30 bg-warning/5 text-warning",
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[color]}`}>
      <Icon className="w-4 h-4 mb-2 opacity-80" />
      <p className="text-xl font-syne font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted mt-1">{label}</p>
    </div>
  );
}
