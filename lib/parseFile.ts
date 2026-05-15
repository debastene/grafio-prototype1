/**
 * Read a tail-aware sample of a file as plain text for sending to Claude.
 * Text formats are decoded normally; binary formats return metadata only.
 */

const TEXT_EXT = new Set([
  "csv", "tsv", "txt", "log", "md",
  "json", "jsonl", "ndjson",
  "xml", "yaml", "yml",
  "ipynb",
]);

const BINARY_EXT = new Set([
  "xlsx", "xls", "xlsm",
  "parquet", "feather", "arrow",
  "pkl", "pickle",
  "h5", "hdf5",
  "orc", "avro",
  "sav", "dta", "sas7bdat",
  "db", "sqlite", "duckdb",
  "pdf",
]);

export type FileSample = {
  fileName: string;
  ext: string;
  size: number;
  isBinary: boolean;
  sample: string;
  meta: string;
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function parseFileSample(file: File, maxChars = 6000): Promise<FileSample> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const meta = `${ext.toUpperCase()} · ${fmtSize(file.size)}`;

  if (TEXT_EXT.has(ext) || (!BINARY_EXT.has(ext) && file.type.startsWith("text/"))) {
    // Read up to 2x maxChars in raw bytes to be safe with multi-byte chars
    const blob = file.slice(0, maxChars * 2);
    let text = await blob.text();
    if (text.length > maxChars) text = text.slice(0, maxChars);
    return {
      fileName: file.name,
      ext,
      size: file.size,
      isBinary: false,
      sample: text,
      meta,
    };
  }

  return {
    fileName: file.name,
    ext,
    size: file.size,
    isBinary: true,
    sample: "",
    meta: `${meta} · binary format — sample tidak tersedia di prototype client`,
  };
}
