"use client";
import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, FileJson, FileText, Sparkles, X } from "lucide-react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, SUPPORTED_EXTENSIONS } from "@/lib/engine";

// Hanya format yang BENAR-BENAR bisa diparse engine. Dulu daftar ini memuat
// Excel/Parquet/SQLite/SPSS/… yang lalu gagal di langkah berikutnya.
const ACCEPT_ATTR = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",");

const FILE_ICON: Record<string, any> = {
  csv: FileSpreadsheet, tsv: FileSpreadsheet,
  json: FileJson, jsonl: FileJson, ndjson: FileJson,
  txt: FileText,
};

function isSupported(name: string): boolean {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

type Props = { onDemo?: () => void; onFiles?: (files: File[]) => void };

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadZone({ onDemo, onFiles }: Props) {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    const ok: File[] = [];
    const tooBig: string[] = [];
    const unsupported: string[] = [];
    arr.forEach((f) => {
      if (!isSupported(f.name)) {
        unsupported.push(f.name);
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        tooBig.push(f.name);
        return;
      }
      ok.push(f);
    });
    const problems: string[] = [];
    if (tooBig.length) problems.push(`File terlalu besar (maks ${MAX_UPLOAD_LABEL}): ${tooBig.join(", ")}`);
    if (unsupported.length) {
      problems.push(
        `Format belum didukung: ${unsupported.join(", ")} — ekspor dulu ke CSV (Excel: File → Save As → CSV).`,
      );
    }
    setError(problems.length ? problems.join(" · ") : null);
    const next = [...files, ...ok];
    setFiles(next);
    onFiles?.(next);
  };

  const remove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    onFiles?.(next);
  };

  const handleClick = () => inputRef.current?.click();

  return (
    <div className="space-y-4">
      <div
        onClick={handleClick}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files);
        }}
        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-12 md:p-14 flex flex-col items-center justify-center gap-4 transition-all duration-400 ease-glide overflow-hidden group ${
          drag
            ? "border-cyan bg-cyan/8 shadow-glow-lg scale-[1.01]"
            : "border-borderColor hover:border-cyan/55 bg-bgSurface/70 backdrop-blur-sm hover:bg-bgSurface"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => accept(e.target.files)}
        />
        {/* Decorative bg orb that grows on drag */}
        <div className={`absolute inset-0 bg-grad-mesh opacity-0 transition-opacity duration-600 ease-glide pointer-events-none ${drag ? "opacity-50" : "group-hover:opacity-25"}`} />
        <div className={`relative w-20 h-20 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center transition-all duration-400 ease-glide ${drag ? "scale-110 bg-cyan/20" : "animate-pulseGlow"}`}>
          <UploadCloud className="w-8 h-8 text-cyan" />
        </div>
        <div className="relative text-center">
          <p className="text-white font-syne font-semibold text-xl">
            {drag ? "Lepaskan di sini!" : "Drag & drop atau klik untuk upload"}
          </p>
          <p className="text-sm text-muted mt-1.5">
            Data tabular teks — Excel? Simpan sebagai CSV dulu
          </p>
        </div>
        <div className="relative flex flex-wrap gap-1.5 justify-center max-w-xl">
          {["CSV", "TSV", "TXT", "JSON", "JSONL"].map((t) => (
            <span
              key={t}
              className="px-2.5 py-1 bg-bgElevated/70 backdrop-blur-sm border border-borderColor text-[11px] text-muted rounded-full font-mono"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex items-center gap-3 mt-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft hover:shadow-glow-lg transition-all duration-300 ease-glide text-sm shadow-glow font-syne tracking-wide active:scale-[0.97]"
          >
            Pilih File
          </button>
          {onDemo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDemo();
              }}
              className="px-5 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan hover:bg-cyan/5 transition-all duration-300 ease-glide text-sm flex items-center gap-1.5 font-syne tracking-wide active:scale-[0.97]"
            >
              <Sparkles className="w-3.5 h-3.5" /> Coba Data Demo
            </button>
          )}
        </div>
        <p className="relative text-xs text-muted">
          Maks {MAX_UPLOAD_LABEL} per file · diproses di browser · data pribadi disamarkan sebelum ke AI
        </p>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 animate-fadeUp">
          <p className="text-xs uppercase tracking-[0.2em] text-muted font-mono">
            {files.length} file siap dianalisis
          </p>
          {files.map((f, i) => {
            const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
            const Icon = FILE_ICON[ext] ?? FileText;
            return (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 bg-bgSurface/70 backdrop-blur-sm border border-borderColor rounded-md px-3 py-2.5 hover:border-cyan/40 transition-colors duration-300 ease-glide group"
              >
                <div className="w-9 h-9 rounded-md bg-cyan/10 border border-cyan/25 flex items-center justify-center text-cyan group-hover:bg-cyan/15 transition-colors duration-300">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-medium">{f.name}</p>
                  <p className="text-xs text-muted font-mono">
                    {ext.toUpperCase()} · {fmtSize(f.size)}
                  </p>
                </div>
                <button
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
