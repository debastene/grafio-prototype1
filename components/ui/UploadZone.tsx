"use client";
import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, FileJson, FileText, Database, Sparkles, X } from "lucide-react";

const ACCEPTED = [
  ".csv", ".tsv", ".xlsx", ".xls", ".xlsm",
  ".json", ".jsonl", ".ndjson",
  ".parquet", ".feather", ".arrow",
  ".sav", ".dta", ".sas7bdat",
  ".pkl", ".pickle",
  ".h5", ".hdf5",
  ".orc", ".avro",
  ".txt", ".log",
  ".db", ".sqlite", ".duckdb",
  ".ipynb", ".pdf",
];

const ACCEPT_ATTR = ACCEPTED.join(",");

const FILE_ICON: Record<string, any> = {
  csv: FileSpreadsheet, tsv: FileSpreadsheet, xlsx: FileSpreadsheet, xls: FileSpreadsheet, xlsm: FileSpreadsheet,
  json: FileJson, jsonl: FileJson, ndjson: FileJson,
  txt: FileText, log: FileText, ipynb: FileText, pdf: FileText,
  parquet: Database, feather: Database, arrow: Database,
  pkl: Database, pickle: Database, h5: Database, hdf5: Database,
  db: Database, sqlite: Database, duckdb: Database, orc: Database, avro: Database,
  sav: FileSpreadsheet, dta: FileSpreadsheet, sas7bdat: FileSpreadsheet,
};

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
    arr.forEach((f) => {
      if (f.size > 50 * 1024 * 1024) {
        tooBig.push(f.name);
        return;
      }
      ok.push(f);
    });
    if (tooBig.length) {
      setError(`File terlalu besar (max 50MB): ${tooBig.join(", ")}`);
    } else {
      setError(null);
    }
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
        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
          drag
            ? "border-cyan bg-cyan/5 shadow-glow"
            : "border-borderColor hover:border-cyan/50 bg-bgSurface"
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
        <div className="w-16 h-16 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center animate-pulseGlow">
          <UploadCloud className="w-7 h-7 text-cyan" />
        </div>
        <div className="text-center">
          <p className="text-white font-syne font-semibold text-lg">
            Drag &amp; drop atau klik untuk upload
          </p>
          <p className="text-sm text-muted mt-1">
            Semua format data analyst &amp; data scientist didukung
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center max-w-xl">
          {["CSV", "TSV", "Excel", "JSON", "Parquet", "Feather", "Arrow", "Pickle", "HDF5", "ORC", "Avro", "SQLite", "DuckDB", "SPSS", "Stata", "SAS", "Notebook"].map((t) => (
            <span
              key={t}
              className="px-2.5 py-1 bg-bgElevated border border-borderColor text-[11px] text-muted rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-5 py-2.5 rounded-md bg-cyan text-bgDeep font-semibold hover:bg-cyanSoft transition-all text-sm"
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
              className="px-5 py-2.5 rounded-md border border-borderColor text-white hover:border-cyan hover:text-cyan transition-all text-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Coba Data Demo
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Max 50MB per file · enkripsi end-to-end</p>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted">{files.length} file siap dianalisis</p>
          {files.map((f, i) => {
            const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
            const Icon = FILE_ICON[ext] ?? FileText;
            return (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 bg-bgSurface border border-borderColor rounded-md px-3 py-2"
              >
                <div className="w-9 h-9 rounded-md bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{f.name}</p>
                  <p className="text-xs text-muted">
                    {ext.toUpperCase()} · {fmtSize(f.size)}
                  </p>
                </div>
                <button
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="p-1.5 text-muted hover:text-danger transition-colors"
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
