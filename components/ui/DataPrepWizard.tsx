"use client";
import { useState, useEffect, useMemo } from "react";
import { Inspection } from "@/lib/engine";
import {
  CleaningPlan,
  DEFAULT_PLAN,
  CleaningIssue,
  applyCleaning,
  computeHealthScore,
  detectIssues,
  recommendPlan,
} from "@/lib/engine/clean";
import { ParsedRow } from "@/lib/engine/parse";
import CleanedDataDownload from "./CleanedDataDownload";
import {
  CheckCircle2, AlertTriangle, Sparkles, Settings2,
  WandSparkles, ChevronRight, Loader2, ArrowLeft, Brain,
  ShieldCheck, Activity, Wand2, MessageSquare, Heart, ArrowRight,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type AiClarification = {
  understanding?: string;
  keyColumns?: string[];
  suggestedPrompts?: string[];
  cleaningAdvice?: { column: string; issue: string; recommendation: string }[];
  warnings?: string[];
  _model?: string;
};

type Props = {
  file: File;
  inspection: Inspection;
  initialPrompt: string;
  onConfirm: (config: ConfirmConfig) => Promise<void>;
  onBack: () => void;
};

export type ConfirmConfig = {
  numberFormat: "id" | "en";
  cleaningPlan: CleaningPlan;
  prompt: string;
  /** User-confirmed context understanding (from popup). Becomes prefix on prompt. */
  contextNote?: string;
};

type Step = "health" | "cleaning" | "context";

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-cyan",
  medium: "text-warning",
  high: "text-danger",
  mild: "text-cyan",
  extreme: "text-danger",
};

const SEVERITY_BG: Record<string, string> = {
  low: "border-cyan/30 bg-cyan/5",
  medium: "border-warning/30 bg-warning/5",
  high: "border-danger/30 bg-danger/5",
  mild: "border-cyan/30 bg-cyan/5",
  extreme: "border-danger/30 bg-danger/5",
};

function issueId(issue: CleaningIssue): string {
  if (issue.kind === "duplicate_rows") return `duplicate_rows:all`;
  return `${issue.kind}:${"column" in issue ? issue.column : ""}`;
}

function issueLabel(issue: CleaningIssue): string {
  switch (issue.kind) {
    case "missing":
      return `${issue.column} — ${issue.count} sel kosong (${(issue.pct * 100).toFixed(0)}%)`;
    case "duplicate_rows":
      return `${issue.count} baris duplikat di seluruh dataset`;
    case "empty_column":
      return `${issue.column} — kolom 100% kosong`;
    case "constant_column":
      return `${issue.column} — semua nilai sama ("${issue.value}")`;
    case "outliers":
      return `${issue.column} — ${issue.count} nilai ekstrem (outlier)`;
    case "high_cardinality":
      return `${issue.column} — ${issue.unique} nilai unik (kemungkinan teks bebas)`;
  }
}

function issueImpact(issue: CleaningIssue): string {
  switch (issue.kind) {
    case "missing":
      return "Bisa bikin perhitungan rata-rata bias atau model gagal training";
    case "duplicate_rows":
      return "Membuat agregat menggelembung & korelasi palsu";
    case "empty_column":
      return "Kolom tidak punya info, hanya jadi noise";
    case "constant_column":
      return "Tidak memberi variasi, model akan abaikan";
    case "outliers":
      return "Bisa menyetir rata-rata & korelasi jauh dari kenyataan";
    case "high_cardinality":
      return "Kategori terlalu beragam, sulit di-grouping";
  }
}

function issueFixDescription(issue: CleaningIssue, plan: CleaningPlan): string {
  switch (issue.kind) {
    case "missing":
      if (plan.imputeMissing === "mean_median") return "Isi otomatis pakai median (numerik) / modus (kategori)";
      if (plan.imputeMissing === "drop_rows") return "Hapus baris yang punya sel kosong";
      return "Biarkan kosong (tidak diubah)";
    case "duplicate_rows":
      return plan.dropDuplicates ? "Hapus baris duplikat, simpan 1 saja" : "Tidak ada perubahan";
    case "empty_column":
      return plan.dropEmptyColumns ? "Buang kolom dari dataset" : "Pertahankan kolom";
    case "constant_column":
      return plan.dropConstantColumns ? "Buang kolom karena tidak informatif" : "Pertahankan kolom";
    case "outliers":
      return plan.capOutliers ? "Cap nilai ekstrem ke batas 1.5×IQR" : "Tidak diubah (dipertahankan)";
    case "high_cardinality":
      return "Diberi tahu ke engine — tidak ada perubahan data otomatis";
  }
}

function issueSeverity(issue: CleaningIssue): string {
  if ("severity" in issue) return issue.severity;
  return "low";
}

function issueIcon(issue: CleaningIssue) {
  switch (issue.kind) {
    case "missing":
      return "🕳️";
    case "duplicate_rows":
      return "👯";
    case "empty_column":
      return "📭";
    case "constant_column":
      return "📌";
    case "outliers":
      return "📈";
    case "high_cardinality":
      return "🔠";
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DataPrepWizard({ file, inspection, initialPrompt, onConfirm, onBack }: Props) {
  const [step, setStep] = useState<Step>("health");
  const [numberFormat, setNumberFormat] = useState<"id" | "en">(inspection.numberFormat.format);
  const [plan, setPlan] = useState<CleaningPlan>(() => ({
    ...recommendPlan(inspection.issues),
    excludeColumns: [],
  }));

  // Per-issue opt-in: by default ALL issues are checked (fix everything AI suggests).
  // User can uncheck specific anomalies they don't want touched.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(inspection.issues.map(issueId)),
  );

  const [prompt, setPrompt] = useState(initialPrompt);
  const [contextNote, setContextNote] = useState("");
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [ai, setAi] = useState<AiClarification | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  // ===== Fetch AI clarification once =====
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const hardStop = setTimeout(() => ac.abort(), 20_000);

    const run = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "clarify",
            inspection: {
              fileName: inspection.fileName,
              rowCount: inspection.rowCount,
              headers: inspection.headers,
              domain: {
                name: inspection.domain.name,
                description: inspection.domain.description,
              },
              preview: inspection.preview,
              profile: inspection.profile.map((p) => ({
                name: p.name,
                type: p.type,
                missingPct: p.missingPct,
              })),
            },
          }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "AI gagal");
        setAi(data);
      } catch (e) {
        if (cancelled) return;
        setAiError(e instanceof Error ? e.message : "AI tidak merespons");
      } finally {
        clearTimeout(hardStop);
        if (!cancelled) setAiLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      clearTimeout(hardStop);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection.fileName, inspection.rowCount]);

  // ===== Build effective plan based on per-issue selection =====
  const effectivePlan = useMemo<CleaningPlan>(() => {
    // If user unselected an issue, exclude its column from cleaning.
    // (For duplicate_rows the "column" is virtual — handled by the dropDuplicates flag.)
    const excludeColumns: string[] = [];
    let dropDuplicates = plan.dropDuplicates;
    let dropEmptyColumns = plan.dropEmptyColumns;
    let dropConstantColumns = plan.dropConstantColumns;

    for (const iss of inspection.issues) {
      const id = issueId(iss);
      if (selected.has(id)) continue;
      // Issue was un-selected → skip cleaning for that target
      if (iss.kind === "duplicate_rows") {
        dropDuplicates = false;
      } else if (iss.kind === "empty_column") {
        excludeColumns.push(iss.column);
      } else if (iss.kind === "constant_column") {
        excludeColumns.push(iss.column);
      } else if ("column" in iss) {
        excludeColumns.push(iss.column);
      }
    }
    return {
      ...plan,
      dropDuplicates,
      dropEmptyColumns,
      dropConstantColumns,
      excludeColumns: Array.from(new Set([...(plan.excludeColumns ?? []), ...excludeColumns])),
    };
  }, [plan, selected, inspection.issues]);

  // ===== Compute cleaned preview (5 sample rows) =====
  const cleanedPreview = useMemo(() => {
    // Convert preview rows back to ParsedRow form
    const previewRowObjs: ParsedRow[] = inspection.preview.rows.map((rowArr) => {
      const obj: ParsedRow = {};
      inspection.headers.forEach((h, i) => {
        obj[h] = rowArr[i];
      });
      return obj;
    });

    const result = applyCleaning(
      inspection.headers,
      previewRowObjs,
      inspection.profile,
      effectivePlan,
    );

    // Re-detect issues on cleaned rows for "after" health score
    // (using full-dataset profile is fine — sample is small)
    const afterHealth = projectHealthAfter(inspection, effectivePlan, selected);

    return {
      headers: result.headers,
      rows: result.rows.map((r) => result.headers.map((h) => r[h] ?? null)),
      imputedCells: result.imputedCells,
      cappedCells: result.cappedCells,
      removedColumns: result.removedColumns,
      healthAfter: afterHealth,
    };
  }, [inspection, effectivePlan, selected]);

  const totalSelected = selected.size;
  const totalIssues = inspection.issues.length;
  const healthColor = (s: number) =>
    s >= 80 ? "text-mint" : s >= 60 ? "text-cyan" : s >= 40 ? "text-warning" : "text-danger";

  const submit = async () => {
    setSubmitting(true);
    try {
      // Combine user context note with prompt
      const enrichedPrompt = contextNote.trim()
        ? `[Konteks user: ${contextNote.trim()}]\n${prompt.trim()}`.trim()
        : prompt;
      await onConfirm({
        numberFormat,
        cleaningPlan: effectivePlan,
        prompt: enrichedPrompt,
        contextNote: contextNote.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Apply AI's suggested context as the editable context note
  useEffect(() => {
    if (ai?.understanding && !contextNote) {
      setContextNote(ai.understanding);
    }
  }, [ai?.understanding]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <StepIndicator step={step} onBack={onBack} />

      {step === "health" && (
        <HealthStep
          inspection={inspection}
          ai={ai}
          aiLoading={aiLoading}
          aiError={aiError}
          numberFormat={numberFormat}
          setNumberFormat={setNumberFormat}
          onNext={() => setStep("cleaning")}
          healthColor={healthColor}
        />
      )}

      {step === "cleaning" && (
        <CleaningStep
          inspection={inspection}
          ai={ai}
          plan={plan}
          setPlan={setPlan}
          selected={selected}
          setSelected={setSelected}
          totalSelected={totalSelected}
          totalIssues={totalIssues}
          onBack={() => setStep("health")}
          onNext={() => setStep("context")}
        />
      )}

      {step === "context" && (
        <ContextStep
          file={file}
          inspection={inspection}
          ai={ai}
          plan={effectivePlan}
          cleanedPreview={cleanedPreview}
          prompt={prompt}
          setPrompt={setPrompt}
          contextNote={contextNote}
          setContextNote={setContextNote}
          showContextEditor={showContextEditor}
          setShowContextEditor={setShowContextEditor}
          numberFormat={numberFormat}
          onBack={() => setStep("cleaning")}
          onSubmit={submit}
          submitting={submitting}
          aiLoading={aiLoading}
          healthColor={healthColor}
        />
      )}
    </div>
  );
}

// ============================================================
// STEP INDICATOR
// ============================================================

function StepIndicator({ step, onBack }: { step: Step; onBack: () => void }) {
  const steps: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "health", label: "Health Check", icon: Activity },
    { id: "cleaning", label: "Auto Cleaning", icon: Wand2 },
    { id: "context", label: "Konfirmasi & Konteks", icon: MessageSquare },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <button
        onClick={onBack}
        className="text-xs text-muted hover:text-white flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Ganti file
      </button>
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((s, i) => {
          const active = i === currentIdx;
          const done = i < currentIdx;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
                  active
                    ? "bg-cyan text-bgDeep border-cyan shadow-glow"
                    : done
                      ? "bg-mint/10 text-mint border-mint/30"
                      : "bg-bgSurface text-muted border-borderColor"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className={`w-3 h-3 ${done ? "text-mint" : "text-muted"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// STEP 1: HEALTH CHECK
// ============================================================

function HealthStep({
  inspection, ai, aiLoading, aiError, numberFormat, setNumberFormat, onNext, healthColor,
}: {
  inspection: Inspection;
  ai: AiClarification | null;
  aiLoading: boolean;
  aiError: string | null;
  numberFormat: "id" | "en";
  setNumberFormat: (v: "id" | "en") => void;
  onNext: () => void;
  healthColor: (s: number) => string;
}) {
  const issues = inspection.issues;

  return (
    <>
      {/* Hero: Health score + AI understanding */}
      <div className="glass rounded-2xl p-6 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {/* Health Score */}
          <div className="md:col-span-1 flex flex-col items-center justify-center text-center py-2">
            <div className="relative">
              <div className={`text-6xl font-syne font-bold ${healthColor(inspection.healthScore)}`}>
                {inspection.healthScore}
              </div>
              <span className="text-xs text-muted absolute -right-6 top-2">/100</span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted mt-2 flex items-center gap-1">
              <Heart className="w-3 h-3" /> Data Health Score
            </p>
            <p className="text-xs text-muted mt-2 leading-relaxed max-w-[180px]">
              {inspection.healthScore >= 80
                ? "Data sehat — siap dianalisis"
                : inspection.healthScore >= 60
                  ? "Cukup bagus — sedikit perlu dirapikan"
                  : inspection.healthScore >= 40
                    ? "Perlu dibersihkan dulu sebelum analisis"
                    : "Banyak anomali — wajib di-cleaning"}
            </p>
          </div>

          {/* AI understanding */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan animate-spin" />
                ) : (
                  <Brain className="w-3.5 h-3.5 text-cyan" />
                )}
              </div>
              <p className="font-syne font-bold text-white text-sm">
                {aiLoading ? "Grafio AI sedang membaca data…" : "Grafio AI sudah baca data"}
              </p>
              {ai?._model && (
                <span className="ml-auto text-[9px] uppercase tracking-widest text-mint bg-mint/10 px-2 py-0.5 rounded-full border border-mint/30">
                  {ai._model.split("/")[1]?.split(":")[0] ?? ai._model}
                </span>
              )}
            </div>

            {aiLoading && (
              <div className="space-y-2">
                <div className="h-3 bg-bgSurface rounded animate-pulse w-3/4" />
                <div className="h-3 bg-bgSurface rounded animate-pulse w-5/6" />
              </div>
            )}

            {ai?.understanding && !aiLoading && (
              <p className="text-sm text-white leading-relaxed">{ai.understanding}</p>
            )}

            {!ai?.understanding && !aiLoading && (
              <p className="text-sm text-muted leading-relaxed">
                Grafio mendeteksi {inspection.domain.name.toLowerCase()} —{" "}
                {inspection.domain.description.toLowerCase()}
              </p>
            )}

            <div className="flex items-center gap-4 text-[10px] text-muted font-mono flex-wrap pt-2 border-t border-borderColor">
              <span className="text-xl">{inspection.domain.emoji}</span>
              <span className="text-white">{inspection.domain.name}</span>
              <span>·</span>
              <span>{inspection.rowCount.toLocaleString("id")} baris</span>
              <span>·</span>
              <span>{inspection.headers.length} kolom</span>
              <span>·</span>
              <span>{issues.length} anomali terdeteksi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Number format (consolidated) */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-cyan" />
          <p className="font-syne font-bold text-white text-sm">Format Angka di File</p>
          {inspection.numberFormat.ambiguous && (
            <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/30 ml-auto">
              ambigu
            </span>
          )}
        </div>
        <p className="text-xs text-muted mb-3">
          Cara baca <span className="font-mono text-white">1.234,56</span>?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setNumberFormat("id")}
            className={`text-left rounded-md border p-3 transition-all ${
              numberFormat === "id"
                ? "border-cyan bg-cyan/10"
                : "border-borderColor bg-bgSurface hover:border-cyan/50"
            }`}
          >
            <p className="text-xs font-syne font-bold text-white mb-0.5">🇮🇩 Indonesia</p>
            <p className="text-[11px] text-muted font-mono">1.234,56 → 1234.56</p>
          </button>
          <button
            onClick={() => setNumberFormat("en")}
            className={`text-left rounded-md border p-3 transition-all ${
              numberFormat === "en"
                ? "border-cyan bg-cyan/10"
                : "border-borderColor bg-bgSurface hover:border-cyan/50"
            }`}
          >
            <p className="text-xs font-syne font-bold text-white mb-0.5">🇺🇸 English / US</p>
            <p className="text-[11px] text-muted font-mono">1,234.56 → 1234.56</p>
          </button>
        </div>
      </div>

      {/* Anomalies list */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <p className="font-syne font-bold text-white text-sm">
            Anomali Terdeteksi{" "}
            <span className="text-muted text-xs ml-1 font-normal">
              ({issues.length} item)
            </span>
          </p>
        </div>

        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-mint py-4 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Tidak ada anomali penting. Data Anda sudah bersih.
          </div>
        ) : (
          <div className="space-y-2">
            {issues.slice(0, 10).map((iss, i) => {
              const sev = issueSeverity(iss);
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-md border p-3 ${SEVERITY_BG[sev]}`}
                >
                  <span className="text-lg flex-shrink-0">{issueIcon(iss)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-tight">{issueLabel(iss)}</p>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      {issueImpact(iss)}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      sev === "high" || sev === "extreme"
                        ? "text-danger border-danger/30 bg-danger/10"
                        : sev === "medium"
                          ? "text-warning border-warning/30 bg-warning/10"
                          : "text-cyan border-cyan/30 bg-cyan/10"
                    }`}
                  >
                    {sev}
                  </span>
                </div>
              );
            })}
            {issues.length > 10 && (
              <p className="text-[11px] text-muted">+ {issues.length - 10} anomali lainnya</p>
            )}
          </div>
        )}

        {aiError && (
          <p className="text-[11px] text-muted mt-3 italic">
            (AI analyzer offline — engine local tetap jalan)
          </p>
        )}
      </div>

      {/* Raw data preview */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint" />
            <p className="font-syne font-bold text-white text-sm">Preview Data Mentah</p>
          </div>
          <span className="text-[10px] text-muted">
            {inspection.rowCount} baris × {inspection.headers.length} kolom
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border border-borderColor">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bgSurface text-left border-b border-borderColor">
                {inspection.preview.headers.slice(0, 8).map((h) => (
                  <th key={h} className="py-2 px-3 text-muted font-mono uppercase tracking-wider truncate">
                    {h}
                  </th>
                ))}
                {inspection.preview.headers.length > 8 && (
                  <th className="py-2 px-3 text-muted">…</th>
                )}
              </tr>
            </thead>
            <tbody>
              {inspection.preview.rows.map((row, i) => (
                <tr key={i} className="border-b border-borderColor/40 last:border-0">
                  {row.slice(0, 8).map((cell, j) => (
                    <td key={j} className="py-2 px-3 text-white font-mono truncate max-w-[140px]">
                      {cell === null || cell === undefined || cell === "" ? (
                        <span className="text-warning">— kosong</span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                  {row.length > 8 && <td className="py-2 px-3 text-muted">…</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow flex items-center gap-2 font-syne"
        >
          {issues.length > 0 ? (
            <>
              Lanjut ke Auto Cleaning <ChevronRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Lewati & ke Konteks <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </>
  );
}

// ============================================================
// STEP 2: AUTO CLEANING
// ============================================================

function CleaningStep({
  inspection, ai, plan, setPlan, selected, setSelected, totalSelected, totalIssues, onBack, onNext,
}: {
  inspection: Inspection;
  ai: AiClarification | null;
  plan: CleaningPlan;
  setPlan: (p: CleaningPlan) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  totalSelected: number;
  totalIssues: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const toggleIssue = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(inspection.issues.map(issueId)));
  const deselectAll = () => setSelected(new Set());

  return (
    <>
      <div className="glass rounded-2xl p-5 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
            <Wand2 className="w-4 h-4 text-cyan" />
          </div>
          <div className="flex-1">
            <p className="font-syne font-bold text-white text-sm mb-0.5">
              Pilih Anomali yang Mau Diperbaiki
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Default: semua anomali akan dibereskan oleh AI. Uncheck kalau ada yang mau kamu pertahankan
              (mungkin kamu sudah tahu konteks data tersebut).
            </p>
          </div>
        </div>
      </div>

      {/* AI cleaning advice (if available) */}
      {ai?.cleaningAdvice && ai.cleaningAdvice.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-purple/20 bg-gradient-to-br from-purple/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple" />
            <p className="font-syne font-bold text-white text-sm">Saran AI</p>
          </div>
          <ul className="space-y-1.5">
            {ai.cleaningAdvice.slice(0, 4).map((c, i) => (
              <li key={i} className="text-xs text-white flex items-start gap-2 leading-relaxed">
                <WandSparkles className="w-3 h-3 text-mint mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-mono text-cyan">{c.column}</span>:{" "}
                  <span className="text-muted">{c.issue}</span> — {c.recommendation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-issue selection */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <p className="font-syne font-bold text-white text-sm">
            {totalSelected} / {totalIssues} anomali dipilih
          </p>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-[11px] px-2.5 py-1 rounded-md border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors"
            >
              Pilih semua
            </button>
            <button
              onClick={deselectAll}
              className="text-[11px] px-2.5 py-1 rounded-md border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors"
            >
              Kosongkan
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {inspection.issues.map((iss, i) => {
            const id = issueId(iss);
            const checked = selected.has(id);
            const sev = issueSeverity(iss);
            return (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-bgSurface/40 transition-colors ${
                  checked ? SEVERITY_BG[sev] : "border-borderColor bg-transparent"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIssue(id)}
                  className="mt-0.5 accent-cyan flex-shrink-0"
                />
                <span className="text-lg flex-shrink-0">{issueIcon(iss)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-tight">{issueLabel(iss)}</p>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    {checked ? `→ ${issueFixDescription(iss, plan)}` : "→ tidak diubah"}
                  </p>
                </div>
                <span
                  className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full ${SEVERITY_COLOR[sev]} flex-shrink-0`}
                >
                  {sev}
                </span>
              </label>
            );
          })}
        </div>

        {/* Cleaning method options */}
        <div className="mt-5 pt-4 border-t border-borderColor space-y-3">
          <p className="font-syne font-semibold text-white text-sm">Metode Cleaning</p>

          <MethodGroup label="Nilai kosong (missing values)">
            {(["mean_median", "drop_rows", "none"] as const).map((opt) => (
              <MethodOption
                key={opt}
                checked={plan.imputeMissing === opt}
                onClick={() => setPlan({ ...plan, imputeMissing: opt })}
                label={
                  opt === "mean_median"
                    ? "Isi otomatis (median / modus)"
                    : opt === "drop_rows"
                      ? "Hapus baris bermasalah"
                      : "Biarkan kosong"
                }
                desc={
                  opt === "mean_median"
                    ? "AI isi sel kosong dengan nilai median (angka) atau modus (kategori)"
                    : opt === "drop_rows"
                      ? "Buang baris yang punya sel kosong — data lebih bersih tapi jumlah berkurang"
                      : "Tidak dilakukan apa-apa, biarkan sel kosong"
                }
              />
            ))}
          </MethodGroup>

          <MethodGroup label="Operasi struktural">
            <ToggleRow
              label="Buang baris duplikat"
              desc="Jaga 1 saja kalau ada baris yang identik"
              checked={plan.dropDuplicates}
              onChange={(v) => setPlan({ ...plan, dropDuplicates: v })}
            />
            <ToggleRow
              label="Buang kolom 100% kosong"
              desc="Kolom yang seluruhnya null tidak punya informasi"
              checked={plan.dropEmptyColumns}
              onChange={(v) => setPlan({ ...plan, dropEmptyColumns: v })}
            />
            <ToggleRow
              label="Buang kolom konstan"
              desc="Kolom yang semua nilainya sama tidak memberi sinyal"
              checked={plan.dropConstantColumns}
              onChange={(v) => setPlan({ ...plan, dropConstantColumns: v })}
            />
            <ToggleRow
              label="Cap nilai ekstrem (outlier)"
              desc="Batasi nilai aneh ke fence 1.5×IQR — mengurangi distorsi statistik"
              checked={plan.capOutliers}
              onChange={(v) => setPlan({ ...plan, capOutliers: v })}
            />
          </MethodGroup>
        </div>
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Health
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow flex items-center gap-2 font-syne"
        >
          Apply & Lihat Hasil <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

function MethodGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MethodOption({
  checked, onClick, label, desc,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md border p-3 transition-all ${
        checked
          ? "border-cyan bg-cyan/10"
          : "border-borderColor bg-bgSurface/40 hover:border-cyan/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
            checked ? "border-cyan bg-cyan" : "border-borderColor"
          }`}
        >
          {checked && <div className="w-full h-full rounded-full bg-bgDeep scale-50" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${checked ? "text-cyan" : "text-white"}`}>{label}</p>
          <p className="text-[11px] text-muted leading-relaxed mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer hover:bg-bgSurface/40 rounded-md p-2 -mx-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-cyan flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white">{label}</p>
        <p className="text-[11px] text-muted leading-relaxed">{desc}</p>
      </div>
    </label>
  );
}

// ============================================================
// STEP 3: CONFIRM + CONTEXT
// ============================================================

function ContextStep({
  file, inspection, ai, plan, cleanedPreview, prompt, setPrompt, contextNote, setContextNote,
  showContextEditor, setShowContextEditor, numberFormat, onBack, onSubmit, submitting, aiLoading, healthColor,
}: {
  file: File;
  inspection: Inspection;
  ai: AiClarification | null;
  plan: CleaningPlan;
  cleanedPreview: {
    headers: string[];
    rows: (string | number | boolean | null)[][];
    imputedCells: number;
    cappedCells: number;
    removedColumns: string[];
    healthAfter: number;
  };
  prompt: string;
  setPrompt: (v: string) => void;
  contextNote: string;
  setContextNote: (v: string) => void;
  showContextEditor: boolean;
  setShowContextEditor: (v: boolean) => void;
  numberFormat: "id" | "en";
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  aiLoading: boolean;
  healthColor: (s: number) => string;
}) {
  const beforeRows = inspection.rowCount;
  const afterRows = beforeRows - estimateRowsRemoved(inspection, plan);
  const beforeCols = inspection.headers.length;
  const afterCols = beforeCols - cleanedPreview.removedColumns.length;

  return (
    <>
      {/* Before/After health summary */}
      <div className="glass rounded-2xl p-6 border border-mint/20 bg-gradient-to-br from-mint/5 to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-mint" />
          <p className="font-syne font-bold text-white">Hasil Cleaning</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock
            label="Health Score"
            before={inspection.healthScore}
            after={cleanedPreview.healthAfter}
            unit=""
            colorAfter={healthColor(cleanedPreview.healthAfter)}
          />
          <StatBlock
            label="Total Baris"
            before={beforeRows}
            after={afterRows}
            unit=" baris"
            colorAfter="text-white"
          />
          <StatBlock
            label="Total Kolom"
            before={beforeCols}
            after={afterCols}
            unit=" kolom"
            colorAfter="text-white"
          />
          <div className="rounded-md border border-borderColor bg-bgSurface/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted">Sel Diperbaiki</p>
            <p className="text-xl font-syne font-bold text-mint mt-1">
              {(cleanedPreview.imputedCells + cleanedPreview.cappedCells).toLocaleString("id")}
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {cleanedPreview.imputedCells} diisi · {cleanedPreview.cappedCells} di-cap
            </p>
          </div>
        </div>
      </div>

      {/* Cleaned data preview */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint" />
            <p className="font-syne font-bold text-white text-sm">
              Preview Data Setelah Cleaning
            </p>
          </div>
          <span className="text-[10px] text-muted">5 baris pertama</span>
        </div>
        <div className="overflow-x-auto rounded-md border border-mint/20">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-mint/5 text-left border-b border-mint/20">
                {cleanedPreview.headers.slice(0, 8).map((h) => (
                  <th key={h} className="py-2 px-3 text-mint font-mono uppercase tracking-wider truncate">
                    {h}
                  </th>
                ))}
                {cleanedPreview.headers.length > 8 && (
                  <th className="py-2 px-3 text-muted">…</th>
                )}
              </tr>
            </thead>
            <tbody>
              {cleanedPreview.rows.map((row, i) => (
                <tr key={i} className="border-b border-borderColor/40 last:border-0">
                  {row.slice(0, 8).map((cell, j) => (
                    <td key={j} className="py-2 px-3 text-white font-mono truncate max-w-[140px]">
                      {cell === null || cell === undefined ? (
                        <span className="text-muted">—</span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                  {row.length > 8 && <td className="py-2 px-3 text-muted">…</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cleanedPreview.removedColumns.length > 0 && (
          <p className="text-[11px] text-muted mt-2">
            <span className="text-warning">Kolom dibuang:</span>{" "}
            {cleanedPreview.removedColumns.join(", ")}
          </p>
        )}
      </div>

      {/* DOWNLOAD CLEANED DATA (evaluasi 16 Mei — poin 1) */}
      <CleanedDataDownload
        file={file}
        inspection={inspection}
        plan={plan}
        numberFormat={numberFormat}
      />

      {/* CONTEXT CONFIRMATION POPUP (poin 4) */}
      <div className="glass rounded-2xl p-5 border border-purple/20 bg-gradient-to-br from-purple/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="font-syne font-bold text-white text-sm">
                Konfirmasi Konteks Data
              </p>
              <button
                onClick={() => setShowContextEditor(!showContextEditor)}
                className="text-[11px] text-cyan hover:text-cyanSoft transition-colors"
              >
                {showContextEditor ? "Sembunyikan editor" : "Edit / tambahkan"}
              </button>
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Ini pemahaman AI tentang data kamu. Kalau ada yang salah atau kurang lengkap, koreksi di
              bawah — Grafio akan pakai konteks ini untuk analisis yang lebih relevan.
            </p>

            {!showContextEditor ? (
              <div className="rounded-md bg-bgSurface/60 border border-borderColor p-3 text-sm text-white leading-relaxed">
                {contextNote || (aiLoading ? "AI sedang menganalisis konteks…" : "Belum ada konteks yang dikonfirmasi.")}
              </div>
            ) : (
              <textarea
                value={contextNote}
                onChange={(e) => setContextNote(e.target.value)}
                rows={4}
                placeholder="Contoh: Ini data penjualan toko fashion online untuk Q2 2025. Bulan Mei kami mulai kampanye Ramadhan jadi lonjakan di kolom 'sales_mei' bukan anomali tapi kampanye."
                className="w-full bg-bgSurface border border-purple/30 rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 resize-none focus:outline-none focus:border-purple/60"
              />
            )}

            {ai?.warnings && ai.warnings.length > 0 && (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-2.5">
                <p className="text-[10px] uppercase tracking-widest text-warning mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Catatan dari AI
                </p>
                <ul className="text-xs text-white space-y-0.5">
                  {ai.warnings.slice(0, 3).map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* USER PROMPT */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan" />
          <p className="font-syne font-bold text-white text-sm">Arahan Analisis (opsional)</p>
        </div>
        <p className="text-xs text-muted mb-3 leading-relaxed">
          Ada fokus spesifik yang mau kamu eksplorasi? Tulis di sini, atau pilih dari saran AI.
          Kalau dikosongkan, Grafio akan analisis menyeluruh.
        </p>

        {ai?.suggestedPrompts && ai.suggestedPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ai.suggestedPrompts.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-purple/40 bg-purple/5 text-purple hover:bg-purple/20 transition-colors text-left"
              >
                ✨ {s}
              </button>
            ))}
          </div>
        )}

        {inspection.domain.suggestedPrompts && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {inspection.domain.suggestedPrompts.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Contoh: fokus pada tren bulanan dan korelasi antara harga & jumlah pesanan. Kosongkan untuk analisis menyeluruh."
          className="w-full bg-bgSurface border border-borderColor rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 resize-none focus:outline-none focus:border-cyan/50"
        />
      </div>

      {/* SUBMIT */}
      <div className="flex justify-between gap-3 pt-2 flex-wrap">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-colors text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Atur Ulang Cleaning
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] text-muted">
            Format {numberFormat.toUpperCase()} ·{" "}
            {cleanedPreview.imputedCells + cleanedPreview.cappedCells} sel diperbaiki ·{" "}
            siap dianalisis
          </p>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 font-syne"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Menganalisis…
              </>
            ) : (
              <>
                Mulai Analisis <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function StatBlock({
  label, before, after, unit, colorAfter,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  colorAfter: string;
}) {
  const delta = after - before;
  const positive = (label.toLowerCase().includes("score")) ? delta >= 0 : delta <= 0;
  return (
    <div className="rounded-md border border-borderColor bg-bgSurface/40 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-xs text-muted line-through font-mono">
          {before.toLocaleString("id")}{unit}
        </span>
        <span className="text-[10px] text-muted">→</span>
        <span className={`text-xl font-syne font-bold ${colorAfter}`}>
          {after.toLocaleString("id")}{unit}
        </span>
      </div>
      {delta !== 0 && (
        <p className={`text-[10px] mt-0.5 ${positive ? "text-mint" : "text-warning"}`}>
          {delta > 0 ? "+" : ""}{delta.toLocaleString("id")}
        </p>
      )}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Project the post-cleaning health score without re-running on full data.
 * Conservative estimate: subtract the issues that the user opted to fix.
 */
function projectHealthAfter(
  inspection: Inspection,
  plan: CleaningPlan,
  selected: Set<string>,
): number {
  const excluded = new Set(plan.excludeColumns ?? []);
  const remaining: CleaningIssue[] = inspection.issues.filter((iss) => {
    const id = issueId(iss);
    if (!selected.has(id)) return true; // user kept this issue → stays
    if (iss.kind === "duplicate_rows") return !plan.dropDuplicates;
    if (iss.kind === "empty_column") return !plan.dropEmptyColumns || excluded.has(iss.column);
    if (iss.kind === "constant_column") return !plan.dropConstantColumns || excluded.has(iss.column);
    if (iss.kind === "missing" && plan.imputeMissing !== "none" && !excluded.has(iss.column)) return false;
    if (iss.kind === "outliers" && plan.capOutliers && !excluded.has(iss.column)) return false;
    return true;
  });
  return computeHealthScore(inspection.profile, remaining);
}

function estimateRowsRemoved(inspection: Inspection, plan: CleaningPlan): number {
  let removed = 0;
  if (plan.dropDuplicates) {
    const dup = inspection.issues.find((i) => i.kind === "duplicate_rows");
    if (dup && dup.kind === "duplicate_rows") removed += dup.count;
  }
  if (plan.imputeMissing === "drop_rows") {
    // Rough estimate: union of rows that have any missing in non-excluded columns.
    // Without scanning the full table here, approximate by max missing% × rowCount.
    const excluded = new Set(plan.excludeColumns ?? []);
    let maxMissingPct = 0;
    for (const p of inspection.profile) {
      if (excluded.has(p.name)) continue;
      if (p.missingPct > maxMissingPct) maxMissingPct = p.missingPct;
    }
    removed += Math.round(maxMissingPct * inspection.rowCount);
  }
  return removed;
}
