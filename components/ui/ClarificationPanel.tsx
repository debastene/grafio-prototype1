"use client";
import { useState, useEffect } from "react";
import { Inspection } from "@/lib/engine";
import { CleaningPlan, DEFAULT_PLAN, CleaningIssue } from "@/lib/engine/clean";
import {
  CheckCircle2, AlertTriangle, Sparkles, Settings2, Trash2,
  WandSparkles, ChevronRight, Loader2, ArrowLeft, Brain,
} from "lucide-react";

type AiClarification = {
  understanding?: string;
  keyColumns?: string[];
  suggestedPrompts?: string[];
  cleaningAdvice?: { column: string; issue: string; recommendation: string }[];
  warnings?: string[];
  _model?: string;
};

type Props = {
  inspection: Inspection;
  initialPrompt: string;
  onConfirm: (config: ConfirmConfig) => Promise<void>;
  onBack: () => void;
};

export type ConfirmConfig = {
  numberFormat: "id" | "en";
  cleaningPlan: CleaningPlan;
  prompt: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-cyan",
  medium: "text-warning",
  high: "text-danger",
  mild: "text-cyan",
  extreme: "text-danger",
};

function issueLabel(issue: CleaningIssue): string {
  switch (issue.kind) {
    case "missing":
      return `${issue.column}: ${issue.count} cell kosong (${(issue.pct * 100).toFixed(0)}%)`;
    case "duplicate_rows":
      return `${issue.count} baris duplikat`;
    case "empty_column":
      return `${issue.column}: kolom 100% kosong`;
    case "constant_column":
      return `${issue.column}: nilai konstan ("${issue.value}")`;
    case "outliers":
      return `${issue.column}: ${issue.count} outlier (Z≥2.5)`;
    case "high_cardinality":
      return `${issue.column}: ${issue.unique} unique values (text bebas?)`;
  }
}

function issueSeverity(issue: CleaningIssue): string {
  if ("severity" in issue) return issue.severity;
  return "low";
}

export default function ClarificationPanel({ inspection, initialPrompt, onConfirm, onBack }: Props) {
  const [numberFormat, setNumberFormat] = useState<"id" | "en">(inspection.numberFormat.format);
  const [plan, setPlan] = useState<CleaningPlan>(DEFAULT_PLAN);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<AiClarification | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fire AI clarification once when this panel mounts with an inspection.
  // Hard cap total wait at 20s — kalau lebih, abort & sembunyikan card.
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
    // Run only once per inspection reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection.fileName, inspection.rowCount]);

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm({ numberFormat, cleaningPlan: plan, prompt });
    } finally {
      setLoading(false);
    }
  };

  const issues = inspection.issues;
  const healthColor =
    inspection.healthScore >= 80 ? "text-mint" :
    inspection.healthScore >= 60 ? "text-cyan" :
    inspection.healthScore >= 40 ? "text-warning" : "text-danger";

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="text-xs text-muted hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">Health Score</span>
          <span className={`font-mono font-bold text-lg ${healthColor}`}>{inspection.healthScore}</span>
          <span className="text-muted">/ 100</span>
        </div>
      </div>

      {/* AI CLARIFICATION CARD — only renders when AI is loading or succeeded.
          On failure (rate limit / network / no key) we silently hide it so the
          user just sees the engine-driven panels below — no scary warnings. */}
      {(aiLoading || (ai && !aiError)) && (
      <div className="glass rounded-2xl p-5 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
            {aiLoading ? (
              <Loader2 className="w-4 h-4 text-cyan animate-spin" />
            ) : (
              <Brain className="w-4 h-4 text-cyan" />
            )}
          </div>
          <p className="font-syne font-bold text-white text-sm">
            {aiLoading ? "Grafio AI sedang membaca data kamu…" : "Grafio AI sudah baca data kamu"}
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
            <div className="h-3 bg-bgSurface rounded animate-pulse w-2/3" />
          </div>
        )}

        {ai && !aiLoading && (
          <div className="space-y-3">
            {ai.understanding && (
              <p className="text-sm text-white leading-relaxed">{ai.understanding}</p>
            )}

            {ai.keyColumns && ai.keyColumns.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Kolom kunci menurut AI</p>
                <div className="flex flex-wrap gap-1.5">
                  {ai.keyColumns.slice(0, 8).map((c) => (
                    <span
                      key={c}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30 text-cyan"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ai.suggestedPrompts && ai.suggestedPrompts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Saran analisis dari AI</p>
                <div className="flex flex-wrap gap-1.5">
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
              </div>
            )}

            {ai.cleaningAdvice && ai.cleaningAdvice.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">Saran pembersihan dari AI</p>
                <ul className="space-y-1.5">
                  {ai.cleaningAdvice.slice(0, 4).map((c, i) => (
                    <li key={i} className="text-xs text-white flex items-start gap-2">
                      <WandSparkles className="w-3 h-3 text-mint mt-0.5 flex-shrink-0" />
                      <span>
                        <span className="font-mono text-cyan">{c.column}</span>:{" "}
                        <span className="text-muted">{c.issue}</span> → {c.recommendation}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ai.warnings && ai.warnings.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
                <p className="text-[10px] uppercase tracking-widest text-warning mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Peringatan AI
                </p>
                <ul className="text-xs text-white space-y-0.5">
                  {ai.warnings.slice(0, 3).map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* DOMAIN CARD */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0">{inspection.domain.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-syne font-bold text-white">
                {inspection.domain.name}
              </p>
              <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-2 py-0.5 rounded-full border border-cyan/30">
                Confidence {(inspection.domain.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{inspection.domain.description}</p>
            {inspection.domain.matchedColumns.length > 0 && (
              <p className="text-[10px] text-muted mt-2 font-mono">
                Kolom kunci: {inspection.domain.matchedColumns.slice(0, 6).join(", ")}
                {inspection.domain.matchedColumns.length > 6 ? `… +${inspection.domain.matchedColumns.length - 6}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* NUMBER FORMAT */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-cyan" />
          <p className="font-syne font-bold text-white text-sm">Format Angka</p>
          {inspection.numberFormat.ambiguous && (
            <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/30 ml-auto">
              ambigu — pastikan benar
            </span>
          )}
        </div>
        <p className="text-xs text-muted mb-3">
          Bagaimana cara baca <span className="font-mono text-white">1.234,56</span> di file Anda?
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
            <p className="text-[10px] text-muted">titik = ribuan, koma = desimal</p>
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
            <p className="text-[10px] text-muted">koma = ribuan, titik = desimal</p>
          </button>
        </div>
        {inspection.numberFormat.samples.length > 0 && (
          <div className="mt-3 pt-3 border-t border-borderColor">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Sampel dari file Anda</p>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              {inspection.numberFormat.samples.slice(0, 4).map((s, i) => (
                <span key={i} className="text-white">
                  &quot;{s.value}&quot; →{" "}
                  <span className={numberFormat === "id" ? "text-cyan" : "text-muted"}>
                    {s.idParse !== null ? s.idParse.toLocaleString("en") : "—"}
                  </span>
                  {" / "}
                  <span className={numberFormat === "en" ? "text-cyan" : "text-muted"}>
                    {s.enParse !== null ? s.enParse.toLocaleString("en") : "—"}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CLEANING ISSUES */}
      {issues.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <WandSparkles className="w-4 h-4 text-cyan" />
            <p className="font-syne font-bold text-white text-sm">
              Pembersihan Data <span className="text-muted text-xs ml-1">({issues.length} issue)</span>
            </p>
          </div>
          <p className="text-xs text-muted mb-3">
            Pilih operasi yang mau dijalankan sebelum analisis. Pratinjau ada di bawah.
          </p>

          {/* Issues list */}
          <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
            {issues.slice(0, 12).map((iss, i) => {
              const sev = issueSeverity(iss);
              const colorCls = SEVERITY_COLOR[sev] ?? "text-muted";
              return (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  <AlertTriangle className={`w-3 h-3 ${colorCls} flex-shrink-0`} />
                  <span className="text-white truncate">{issueLabel(iss)}</span>
                </div>
              );
            })}
            {issues.length > 12 && (
              <p className="text-[10px] text-muted">+ {issues.length - 12} issue lainnya</p>
            )}
          </div>

          {/* Plan toggles */}
          <div className="grid md:grid-cols-2 gap-2">
            <Toggle
              label="Buang kolom 100% kosong"
              checked={plan.dropEmptyColumns}
              onChange={(v) => setPlan({ ...plan, dropEmptyColumns: v })}
            />
            <Toggle
              label="Buang kolom konstan (1 nilai)"
              checked={plan.dropConstantColumns}
              onChange={(v) => setPlan({ ...plan, dropConstantColumns: v })}
            />
            <Toggle
              label="Buang baris duplikat"
              checked={plan.dropDuplicates}
              onChange={(v) => setPlan({ ...plan, dropDuplicates: v })}
            />
            <Toggle
              label="Cap outlier ke 1.5×IQR fence"
              checked={plan.capOutliers}
              onChange={(v) => setPlan({ ...plan, capOutliers: v })}
            />
          </div>

          {/* Imputation strategy */}
          <div className="mt-3">
            <p className="text-xs text-muted mb-2">Strategi nilai kosong</p>
            <div className="flex gap-2 flex-wrap">
              {(["none", "mean_median", "drop_rows"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPlan({ ...plan, imputeMissing: opt })}
                  className={`text-[11px] px-3 py-1.5 rounded-md border transition-all ${
                    plan.imputeMissing === opt
                      ? "bg-cyan text-bgDeep border-cyan font-semibold"
                      : "text-muted border-borderColor hover:border-cyan/50"
                  }`}
                >
                  {opt === "none"
                    ? "Biarkan kosong"
                    : opt === "mean_median"
                      ? "Imputasi (median/mode)"
                      : "Drop baris bermasalah"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW DATA TABLE */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint" />
            <p className="font-syne font-bold text-white text-sm">Preview Data</p>
          </div>
          <span className="text-[10px] text-muted">{inspection.rowCount} baris × {inspection.headers.length} kolom</span>
        </div>
        <div className="overflow-x-auto rounded-md border border-borderColor">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bgSurface text-left border-b border-borderColor">
                {inspection.preview.headers.slice(0, 7).map((h) => (
                  <th key={h} className="py-2 px-3 text-muted font-mono uppercase tracking-wider truncate">
                    {h}
                  </th>
                ))}
                {inspection.preview.headers.length > 7 && (
                  <th className="py-2 px-3 text-muted">…</th>
                )}
              </tr>
            </thead>
            <tbody>
              {inspection.preview.rows.map((row, i) => (
                <tr key={i} className="border-b border-borderColor/40 last:border-0">
                  {row.slice(0, 7).map((cell, j) => (
                    <td key={j} className="py-2 px-3 text-white font-mono truncate max-w-[140px]">
                      {cell === null ? <span className="text-muted">—</span> : String(cell)}
                    </td>
                  ))}
                  {row.length > 7 && <td className="py-2 px-3 text-muted">…</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUGGESTED PROMPTS + USER PROMPT */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan" />
          <p className="font-syne font-bold text-white text-sm">Arahan Analisis</p>
        </div>
        <p className="text-xs text-muted mb-2">
          Saran berdasarkan domain {inspection.domain.name.toLowerCase()}:
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inspection.domain.suggestedPrompts.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Atau tulis arahan Anda sendiri…"
          className="w-full bg-bgSurface border border-borderColor rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 resize-none focus:outline-none focus:border-cyan/50"
        />
      </div>

      {/* CONFIRM */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-muted">
          Engine akan: format {numberFormat.toUpperCase()} ·{" "}
          {plan.dropDuplicates ? "drop dupes · " : ""}
          {plan.dropEmptyColumns ? "drop empty cols · " : ""}
          {plan.imputeMissing !== "none" ? `${plan.imputeMissing} · ` : ""}
          {plan.capOutliers ? "cap outliers · " : ""}
          analisis penuh
        </p>
        <button
          onClick={submit}
          disabled={loading || aiLoading}
          title={aiLoading ? "Tunggu AI selesai membaca data — biar hasil analisis maksimal" : undefined}
          className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 font-syne"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menganalisis…
            </>
          ) : aiLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Grafio AI sedang membaca data…
            </>
          ) : (
            <>
              Lanjutkan dengan Analisis <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-white cursor-pointer hover:bg-bgSurface/40 rounded p-2 -mx-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-cyan"
      />
      <span>{label}</span>
    </label>
  );
}
