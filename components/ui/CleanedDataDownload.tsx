"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Download, Loader2, Brain, Sparkles, Check, AlertCircle,
  FileText, FileJson, Table, ChevronDown,
} from "lucide-react";
import { Inspection } from "@/lib/engine";
import { applyCleaning, CleaningPlan } from "@/lib/engine/clean";
import { applyNumberFormat } from "@/lib/engine/numberFormat";
import { parseText } from "@/lib/engine/parse";
import {
  serializeRows,
  buildCleaningNotes,
  defaultFormatFromFilename,
  extensionFor,
  mimeFor,
  downloadTextFile,
  type ColumnRename,
  type DownloadFormat,
} from "@/lib/engine/exportClean";

type Props = {
  file: File;
  inspection: Inspection;
  plan: CleaningPlan;
  numberFormat: "id" | "en";
};

const FORMAT_OPTIONS: { value: DownloadFormat; label: string; desc: string; icon: any }[] = [
  { value: "csv", label: "CSV", desc: "Bisa dibuka di Excel, Sheets, Power BI", icon: Table },
  { value: "tsv", label: "TSV", desc: "Tab-separated, kompatibel dgn semua tools", icon: Table },
  { value: "json", label: "JSON", desc: "Untuk developer / pipeline", icon: FileJson },
  { value: "jsonl", label: "JSONL", desc: "1 baris = 1 record, untuk streaming", icon: FileJson },
];

export default function CleanedDataDownload({ file, inspection, plan, numberFormat }: Props) {
  const [format, setFormat] = useState<DownloadFormat>(() =>
    defaultFormatFromFilename(file.name),
  );
  const [renames, setRenames] = useState<ColumnRename[]>(() =>
    inspection.headers.map((h) => ({ original: h, suggested: h, use: "original" as const })),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadOk, setDownloadOk] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch AI rename suggestions once
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const stop = setTimeout(() => ac.abort(), 14_000);
    const run = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            mode: "rename",
            context: {
              headers: inspection.headers,
              domain: inspection.domain.name,
              sample: inspection.preview.rows.slice(0, 3),
            },
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "AI gagal");
        const incoming: { original: string; suggested: string; reason?: string }[] =
          Array.isArray(data.renames) ? data.renames : [];
        // Merge into our state, keep originals for any kolom AI missed
        const byOrig = new Map(incoming.map((r) => [r.original, r]));
        setRenames(
          inspection.headers.map((h) => {
            const r = byOrig.get(h);
            const suggested = r?.suggested?.trim() || h;
            // Only enable "use suggested" by default if it's actually different & short
            const isImprovement =
              suggested !== h && suggested.length > 0 && suggested.length <= 32;
            return {
              original: h,
              suggested,
              use: isImprovement ? "suggested" : "original",
              reason: r?.reason,
            };
          }),
        );
        setAiModel(data._model ?? null);
        setAiDone(true);
      } catch (e) {
        if (cancelled) return;
        setAiError(e instanceof Error ? e.message : "AI offline");
      } finally {
        clearTimeout(stop);
        if (!cancelled) setAiLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      clearTimeout(stop);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection.fileName]);

  const renameChangedCount = useMemo(
    () =>
      renames.filter(
        (r) => r.use === "suggested" && r.suggested !== r.original && r.suggested.length > 0,
      ).length,
    [renames],
  );

  const toggleAll = (useAi: boolean) => {
    setRenames((prev) =>
      prev.map((r) => ({
        ...r,
        use:
          useAi && r.suggested !== r.original && r.suggested.length > 0
            ? "suggested"
            : "original",
      })),
    );
  };

  const toggleOne = (idx: number) => {
    setRenames((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, use: r.use === "suggested" ? "original" : "suggested" } : r,
      ),
    );
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadOk(false);
    try {
      // Re-read & re-clean full file (Inspection only stores 5-row preview)
      const text = await file.text();
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const table = parseText(text, ext);
      const formattedRows = applyNumberFormat(table.rows, table.headers, numberFormat);
      const cleaned = applyCleaning(table.headers, formattedRows, inspection.profile, plan);

      // Filter renames down to columns that still exist after cleaning
      const survivingRenames = renames.filter((r) => cleaned.headers.includes(r.original));

      // 1. Serialize cleaned data
      const dataStr = serializeRows(cleaned.headers, cleaned.rows, format, survivingRenames);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const dataFilename = `${baseName}_cleaned.${extensionFor(format)}`;
      downloadTextFile(dataStr, dataFilename, mimeFor(format));

      // 2. Cleaning notes (Markdown)
      const notes = buildCleaningNotes({
        fileName: file.name,
        originalRowCount: table.rows.length,
        originalColCount: table.headers.length,
        cleanedRowCount: cleaned.rows.length,
        cleanedColCount: cleaned.headers.length,
        plan,
        result: cleaned,
        renames: survivingRenames,
        numberFormat,
        domain: inspection.domain.name,
      });
      // Slight stagger so browser doesn't block 2nd download
      setTimeout(
        () =>
          downloadTextFile(
            notes,
            `${baseName}_cleaning_notes.md`,
            "text/markdown;charset=utf-8",
          ),
        300,
      );

      // 3. Column mapping (only if any rename was applied)
      if (renameChangedCount > 0) {
        const mapping = survivingRenames
          .filter((r) => r.use === "suggested" && r.original !== r.suggested)
          .map((r) => ({ original: r.original, renamed: r.suggested, reason: r.reason }));
        setTimeout(
          () =>
            downloadTextFile(
              JSON.stringify(mapping, null, 2),
              `${baseName}_column_mapping.json`,
              "application/json;charset=utf-8",
            ),
          600,
        );
      }

      setDownloadOk(true);
      setTimeout(() => setDownloadOk(false), 4500);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Gagal generate file");
    } finally {
      setDownloading(false);
    }
  };

  const FormatIcon = FORMAT_OPTIONS.find((f) => f.value === format)?.icon ?? Table;

  return (
    <div className="glass rounded-2xl p-5 border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
          <Download className="w-4 h-4 text-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-syne font-bold text-white text-sm">
            Download Data Hasil Cleaning
          </p>
          <p className="text-xs text-muted leading-relaxed mt-0.5">
            Data sudah dibersihkan dari anomali yang kamu pilih. Bisa kamu unduh untuk dipakai
            di tools lain — kamu juga bisa biarkan AI rapikan nama kolom dulu.
          </p>
        </div>
      </div>

      {/* Format picker */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Format Output</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={`text-left rounded-md border p-2.5 transition-all ${
                  active
                    ? "border-cyan bg-cyan/10"
                    : "border-borderColor bg-bgSurface/40 hover:border-cyan/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-cyan" : "text-muted"}`} />
                  <p className={`text-xs font-syne font-bold ${active ? "text-cyan" : "text-white"}`}>
                    {opt.label}
                  </p>
                </div>
                <p className="text-[10px] text-muted leading-tight">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI rename mapping */}
      <div className="mb-4 rounded-md border border-purple/25 bg-purple/5 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between gap-2 p-3 hover:bg-purple/10 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            {aiLoading ? (
              <Loader2 className="w-4 h-4 text-purple animate-spin flex-shrink-0" />
            ) : (
              <Brain className="w-4 h-4 text-purple flex-shrink-0" />
            )}
            <div className="text-left min-w-0">
              <p className="text-xs font-syne font-bold text-white">
                Rename Kolom oleh AI
              </p>
              <p className="text-[10px] text-muted leading-tight">
                {aiLoading
                  ? "AI sedang membaca nama kolom…"
                  : aiError
                    ? "AI offline — pakai nama asli"
                    : renameChangedCount > 0
                      ? `${renameChangedCount} kolom dirapikan · klik untuk review`
                      : "Semua nama sudah jelas — tidak perlu rename"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {aiModel && !aiLoading && (
              <span className="hidden sm:inline-flex text-[9px] uppercase tracking-widest text-purple bg-purple/10 px-1.5 py-0.5 rounded-full border border-purple/30">
                {aiModel.split("/")[1]?.split(":")[0] ?? aiModel}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {expanded && (
          <div className="border-t border-purple/20 p-3 space-y-2 max-h-[280px] overflow-y-auto">
            {aiError && (
              <div className="text-[11px] text-muted italic flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{aiError}. Kamu masih bisa unduh data dengan nama kolom asli.</span>
              </div>
            )}
            {aiDone && (
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-purple/40 text-purple hover:bg-purple/10 transition-colors"
                >
                  Pakai semua saran AI
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-borderColor text-muted hover:border-cyan hover:text-cyan transition-colors"
                >
                  Reset ke nama asli
                </button>
              </div>
            )}
            {renames.map((r, i) => {
              const isDifferent = r.suggested !== r.original && r.suggested.length > 0;
              const usingAi = r.use === "suggested" && isDifferent;
              return (
                <div
                  key={r.original}
                  className={`flex items-center gap-2 rounded p-1.5 ${
                    usingAi ? "bg-purple/8" : ""
                  }`}
                >
                  <span
                    className={`text-[11px] font-mono truncate flex-1 min-w-0 ${
                      usingAi ? "text-muted line-through" : "text-white"
                    }`}
                    title={r.original}
                  >
                    {r.original}
                  </span>
                  {isDifferent ? (
                    <>
                      <span className="text-muted text-[10px]">→</span>
                      <span
                        className={`text-[11px] font-mono truncate flex-1 min-w-0 ${
                          usingAi ? "text-purple font-semibold" : "text-muted"
                        }`}
                        title={`${r.suggested}${r.reason ? ` — ${r.reason}` : ""}`}
                      >
                        {r.suggested}
                      </span>
                      <button
                        onClick={() => toggleOne(i)}
                        className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                          usingAi
                            ? "border-purple/40 bg-purple/10 text-purple"
                            : "border-borderColor text-muted hover:border-cyan hover:text-cyan"
                        }`}
                      >
                        {usingAi ? "AI ✓" : "asli"}
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] uppercase tracking-widest text-muted">
                      sudah jelas
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Download action */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-cyan" />
          {renameChangedCount > 0
            ? `3 file akan diunduh: data + cleaning notes + column mapping`
            : `2 file akan diunduh: data + cleaning notes`}
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-all font-syne ${
            downloadOk
              ? "bg-mint/15 text-mint border border-mint/40"
              : "bg-cyan text-bgDeep hover:bg-cyanSoft shadow-glow disabled:opacity-60"
          }`}
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan…
            </>
          ) : downloadOk ? (
            <>
              <Check className="w-4 h-4" /> Terdownload
            </>
          ) : (
            <>
              <FormatIcon className="w-4 h-4" /> Download {format.toUpperCase()}
            </>
          )}
        </button>
      </div>
      {downloadError && (
        <p className="text-xs text-danger mt-2 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {downloadError}
        </p>
      )}
    </div>
  );
}
