"use client";
import { useState } from "react";
import { Sparkles, Send, Loader2, AlertTriangle, Cpu } from "lucide-react";
import { analyzeFile, quickInspect, EngineResult, Inspection } from "@/lib/engine";
import DataPrepWizard, { ConfirmConfig } from "./DataPrepWizard";

export type AiResult = EngineResult;

const SUGGESTIONS = [
  "Analisis menyeluruh data ini",
  "Cari tren & pola tersembunyi",
  "Identifikasi anomali dan outlier",
  "Rekomendasi aksi berbasis data",
  "Bandingkan performa antar segmen",
];

type Stage = "prompt" | "clarify" | "analyzing";

type Props = {
  files: File[];
  onComplete: (result: AiResult) => void;
};

export default function AnalysisLauncher({ files, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [prompt, setPrompt] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const startInspection = async () => {
    if (!files.length) {
      setError("Belum ada file. Upload dulu di atas.");
      return;
    }
    setError(null);
    setInspecting(true);
    try {
      const insp = await quickInspect(files[0]);
      setInspection(insp);
      setStage("clarify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file");
    } finally {
      setInspecting(false);
    }
  };

  const runFullAnalysis = async (config: ConfirmConfig) => {
    if (!inspection) return;
    setError(null);
    setStage("analyzing");
    try {
      const result = await analyzeFile(
        files[0],
        config.prompt,
        {
          numberFormat: config.numberFormat,
          cleaningPlan: config.cleaningPlan,
          inspection,
        },
        (s) => setProgress(s),
      );

      // === AI NARRATIVE ENRICHMENT ===
      // Engine returned exact numbers; ask AI to rewrite summary + insights in
      // natural Bahasa Indonesia with those numbers as ground truth.
      // Hard cap 30s — kalau lebih, biarkan engine output apa adanya.
      setProgress("AI sedang menulis insight kontekstual…");
      const narrateAc = new AbortController();
      const narrateStop = setTimeout(() => narrateAc.abort(), 30_000);
      try {
        const narrateRes = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: narrateAc.signal,
          body: JSON.stringify({
            mode: "narrate",
            context: {
              fileName: result.fileName,
              rowCount: result.rowCount,
              domain: `${result.domain.name}${result.domain.description ? " — " + result.domain.description : ""}`,
              userPrompt: config.prompt,
              userContext: config.contextNote,
              columns: result.profile.slice(0, 20).map((p) => ({
                name: p.name,
                type: p.type,
                mean: p.summary?.mean,
                min: p.summary?.min,
                max: p.summary?.max,
              })),
              trends: result.analysis.trends.slice(0, 5).map((t) => ({
                column: t.column,
                direction: t.direction,
                pctChange: t.pctChange,
                r2: t.r2,
                startValue: t.startValue,
                endValue: t.endValue,
              })),
              correlations: result.analysis.correlations.slice(0, 5).map((c) => ({
                a: c.a,
                b: c.b,
                r: c.r,
                direction: c.direction,
                strength: c.strength,
              })),
              anomalies: result.analysis.anomalies.slice(0, 5).map((a) => ({
                column: a.column,
                count: a.count,
                topZscore: a.topExample?.zscore,
              })),
              kpis: result.kpis,
              sample: result.tableSnapshot.rows.slice(0, 5),
            },
          }),
        });
        if (narrateRes.ok) {
          const ai = await narrateRes.json();
          if (typeof ai.summary === "string" && ai.summary.length > 0) {
            result.summary = ai.summary;
          }
          if (typeof ai.conclusion === "string" && ai.conclusion.length > 0) {
            result.conclusion = ai.conclusion;
          }
          if (Array.isArray(ai.insights) && ai.insights.length > 0) {
            result.insights = ai.insights;
          }
          result._meta = {
            ...(result._meta ?? {}),
            model: ai._model ?? result._meta?.model,
          };
        }
        // Store user-provided context for downstream use (chat, etc.)
        if (config.contextNote) {
          result.userContext = config.contextNote;
        }
        // If AI fails, we silently keep engine output — never block analysis.
      } catch {
        /* swallow — engine output remains valid */
      } finally {
        clearTimeout(narrateStop);
      }

      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analisis gagal");
      setStage("clarify");
    }
  };

  // ===== STAGE: CLARIFY (multi-step wizard) =====
  if (stage === "clarify" && inspection) {
    return (
      <DataPrepWizard
        inspection={inspection}
        initialPrompt={prompt}
        onConfirm={runFullAnalysis}
        onBack={() => setStage("prompt")}
      />
    );
  }

  // ===== STAGE: ANALYZING =====
  if (stage === "analyzing") {
    return (
      <div className="glass rounded-2xl p-12 text-center space-y-4">
        <Loader2 className="w-12 h-12 mx-auto text-cyan animate-spin" />
        <div>
          <p className="font-syne font-bold text-white text-lg">Engine sedang menganalisis…</p>
          <p className="text-sm text-muted mt-1">{progress || "Memulai…"}</p>
        </div>
        <div className="max-w-xs mx-auto h-1 bg-bgSurface rounded-full overflow-hidden">
          <div className="h-full bg-cyan animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  // ===== STAGE: PROMPT =====
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center animate-pulseGlow">
            <Cpu className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <p className="font-syne font-bold text-white">Beri arahan ke Grafio Engine</p>
            <p className="text-xs text-muted">
              <span className="text-cyan font-medium">Local statistical engine</span> · OLS regression + Pearson + Z-score · 100% client-side, gratis
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-mint bg-mint/10 px-2 py-1 rounded-full border border-mint/30">
          {files.length} file
        </span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={inspecting}
        rows={3}
        placeholder={`Contoh: "fokus pada GDP dan korelasinya dengan life expectancy" — atau biarkan kosong, kami akan deteksi domain dan beri saran.`}
        className="w-full bg-bgSurface border border-borderColor rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 resize-none focus:outline-none focus:border-cyan/50 disabled:opacity-60"
      />

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            disabled={inspecting}
            className="text-[11px] px-2.5 py-1 rounded-full border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-borderColor flex-wrap">
        <p className="text-xs text-muted flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-cyan" />
          <span>
            Engine akan deteksi domain &amp; format angka, lalu konfirmasi sebelum analisis.
          </span>
        </p>
        <button
          onClick={startInspection}
          disabled={inspecting || !files.length}
          className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm shadow-glow disabled:opacity-50 flex items-center gap-2 font-syne tracking-wide"
        >
          {inspecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Membaca file…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Inspect &amp; Konfirmasi
            </>
          )}
        </button>
      </div>
    </div>
  );
}
