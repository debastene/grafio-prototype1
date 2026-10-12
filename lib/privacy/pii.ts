/**
 * Penyamaran data pribadi (PII) sebelum data meninggalkan Grafio menuju
 * provider AI pihak ketiga (OpenRouter → model gratis yang bisa menyimpan
 * request untuk training).
 *
 * Dua lapis:
 *   1. Berbasis NAMA KOLOM — seluruh nilai kolom seperti "nama", "email",
 *      "no_hp", "alamat", "nik" diganti placeholder. Nama orang tidak bisa
 *      dideteksi andal dari nilainya, jadi nama kolom adalah sinyal terbaik.
 *   2. Berbasis POLA NILAI — email, nomor HP Indonesia, NIK 16 digit,
 *      nomor kartu/rekening panjang di kolom apa pun (termasuk teks bebas).
 *
 * Dipakai di klien (sebelum fetch) DAN server (defense-in-depth) — modul ini
 * isomorfik, tanpa dependensi.
 */

/** Token nama kolom yang isinya dianggap data pribadi. Dicocokkan per token. */
const PII_COLUMN_TOKENS = new Set([
  // identitas (sengaja TIDAK memasukkan "customer"/"pelanggan" — "jumlah_pelanggan" itu metrik)
  "nama", "name", "fullname", "firstname", "lastname", "username",
  "nik", "ktp", "npwp", "nip", "nim", "nrp", "nisn", "passport", "paspor", "ssn",
  // kontak
  "email", "surel", "mail", "phone", "telp", "telepon", "tlp", "hp", "handphone", "ponsel", "whatsapp", "wa",
  // lokasi rinci
  "alamat", "address", "street", "jalan",
  // finansial & kredensial
  "rekening", "norek", "iban", "cvv", "pin", "password", "pwd",
  // lain-lain sensitif (UU PDP: data spesifik)
  "dob", "birthdate", "lahir", "ttl", "agama", "religion", "diagnosis", "penyakit",
]);

/** Pasangan token (mis. "tanggal lahir", "no hp") yang juga dianggap PII. */
const PII_COLUMN_PAIRS: [string, string][] = [
  ["tanggal", "lahir"], ["tgl", "lahir"], ["date", "birth"], ["no", "hp"], ["nomor", "hp"],
  ["no", "telp"], ["nomor", "telepon"], ["ibu", "kandung"], ["card", "number"], ["no", "kartu"],
  ["nomor", "kartu"], ["credit", "card"],
];

function tokens(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isPiiColumn(name: string): boolean {
  const t = tokens(name);
  if (t.some((x) => PII_COLUMN_TOKENS.has(x))) return true;
  return PII_COLUMN_PAIRS.some(([a, b]) => t.includes(a) && t.includes(b));
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// HP Indonesia: +62 / 62 / 0 diikuti 8xx, total 9-13 digit, boleh dipisah spasi/strip.
const PHONE_ID_RE = /(?<![\d])(?:\+62|62|0)8\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,5}(?![\d])/g;
// 16 digit berturut-turut (NIK / nomor kartu kredit), boleh dipisah spasi/strip per 4.
const LONG_ID_RE = /(?<![\d])\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}(?![\d])/g;
// Nomor rekening/ID 10-15 digit murni.
const ACCOUNT_RE = /(?<![\d.,])\d{10,15}(?![\d.,])/g;

/** Samarkan pola PII di dalam teks bebas. Angka biasa (harga, jumlah) tidak disentuh. */
export function maskText(s: string): string {
  return s
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_ID_RE, "[no-hp]")
    .replace(LONG_ID_RE, "[nomor-id]")
    .replace(ACCOUNT_RE, "[nomor]");
}

/** Samarkan satu nilai sel. Nilai numerik hanya disamarkan kalau kolomnya PII. */
export function maskCell(value: unknown, columnIsPii: boolean): unknown {
  if (value === null || value === undefined || value === "") return value;
  if (columnIsPii) return "[disamarkan]";
  if (typeof value === "string") return maskText(value);
  return value;
}

/** Samarkan baris berbentuk object { kolom: nilai }. */
export function maskRecord<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = maskCell(v, isPiiColumn(k));
  return out as T;
}

/** Samarkan baris berbentuk array yang urutannya sesuai `headers`. */
export function maskArrayRow(row: unknown[], headers: string[]): unknown[] {
  return row.map((v, i) => maskCell(v, isPiiColumn(headers[i] ?? "")));
}

/** Samarkan daftar top-values (kategori terbanyak) sebuah kolom. */
export function maskTopValues<T extends { value: string }>(columnName: string, values: T[]): T[] {
  const pii = isPiiColumn(columnName);
  return values.map((t) => ({ ...t, value: pii ? "[disamarkan]" : maskText(String(t.value)) }));
}

/** Hitung berapa kolom yang disamarkan — untuk transparansi di UI. */
export function piiColumns(headers: string[]): string[] {
  return headers.filter(isPiiColumn);
}
