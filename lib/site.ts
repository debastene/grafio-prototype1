/**
 * Identitas situs & kontak — SATU sumber kebenaran.
 *
 * Sebelumnya halaman privacy/security/terms/careers memakai @usegrafio.com,
 * padahal domain itu tidak terdaftar (NXDOMAIN): email mental, dan siapa pun
 * bisa mendaftarkan domain tersebut lalu menerima laporan celah keamanan &
 * permintaan penghapusan data pengguna.
 *
 * Ganti lewat env di Vercel kalau sudah punya domain sendiri:
 *   NEXT_PUBLIC_CONTACT_EMAIL=privacy@domainmu.com
 *   NEXT_PUBLIC_SITE_URL=https://domainmu.com
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grafio-jade.vercel.app";

/** Host untuk label tampilan, mis. "grafio-jade.vercel.app". */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "grafio-jade.vercel.app";
  }
})();

/** Email yang benar-benar dipantau (sama dengan tujuan form /contact). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "grafio.founder@gmail.com";

/** Format file yang benar-benar didukung engine (lihat lib/engine/index.ts). */
export const SUPPORTED_FORMATS_LABEL = "CSV, TSV, TXT, JSON, JSONL";
