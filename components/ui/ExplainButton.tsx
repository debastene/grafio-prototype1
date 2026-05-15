"use client";
import { useState } from "react";
import { Brain, X, Loader2, AlertCircle } from "lucide-react";

type Dataset =
  | { label: string; data: number[] }
  | { label: string; data: { x: number; y: number; r?: number }[] };

type Props = {
  chartType: string;
  chartTitle: string;
  chartDescription?: string;
  labels?: string[];
  datasets?: Dataset[];
  domain?: string;
};

/**
 * Floating "Jelaskan dengan AI" button for chart cards.
 * On click → opens a small modal → fetches /api/explain mode=chart.
 */
export default function ExplainButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const explain = async () => {
    setOpen(true);
    if (text || loading) return; // already fetched / fetching
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chart",
          context: {
            chartType: props.chartType,
            chartTitle: props.chartTitle,
            chartDescription: props.chartDescription,
            labels: props.labels,
            datasets: props.datasets,
            domain: props.domain,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI gagal menjelaskan");
      setText(data.explanation);
      setModel(data._model ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak bisa hubungi AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={explain}
        aria-label="Jelaskan chart ini dengan AI"
        title="Jelaskan dengan AI"
        className="absolute top-3 right-3 w-7 h-7 rounded-md bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 hover:border-cyan transition-colors flex items-center justify-center group"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="absolute -bottom-7 right-0 text-[9px] uppercase tracking-widest text-cyan bg-bgDeep border border-cyan/30 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Jelaskan AI
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-bgDeep/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass rounded-2xl border border-cyan/30 max-w-lg w-full p-6 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center">
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-cyan animate-spin" />
                  ) : (
                    <Brain className="w-4 h-4 text-cyan" />
                  )}
                </div>
                <div>
                  <p className="font-syne font-bold text-white text-sm">
                    {props.chartTitle}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted">
                    {props.chartType} · {loading ? "AI menganalisis chart…" : "Dijelaskan oleh Grafio AI"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-white transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="h-3 bg-bgSurface rounded animate-pulse w-full" />
                <div className="h-3 bg-bgSurface rounded animate-pulse w-5/6" />
                <div className="h-3 bg-bgSurface rounded animate-pulse w-2/3" />
              </div>
            )}

            {error && (
              <div className="text-sm text-danger flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {text && !loading && (
              <>
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                  {text}
                </p>
                {model && (
                  <p className="text-[9px] uppercase tracking-widest text-muted mt-3 pt-3 border-t border-borderColor">
                    via {model.split("/")[1]?.split(":")[0] ?? model}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
