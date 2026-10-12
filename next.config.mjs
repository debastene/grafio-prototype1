/**
 * Security headers untuk semua route.
 *
 * - CSP: hanya muat skrip/style/font dari origin sendiri (font di-self-host
 *   oleh next/font), koneksi hanya ke API sendiri + Supabase. 'unsafe-inline'
 *   untuk script masih dibutuhkan Next 14 (inline bootstrap tanpa nonce);
 *   tetap jauh lebih ketat daripada tanpa CSP sama sekali, dan memblok
 *   exfiltrasi ke domain asing via connect-src.
 * - frame-ancestors 'none' + X-Frame-Options: halaman login tidak bisa
 *   dibungkus iframe situs lain (clickjacking).
 */

const isDev = process.env.NODE_ENV !== "production";
const isPreview = process.env.VERCEL_ENV === "preview";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigins = [];
try {
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    supabaseOrigins = [u.origin, `wss://${u.host}`];
  }
} catch {
  supabaseOrigins = [];
}

// Vercel Toolbar hanya muncul di preview deployment.
const vercelLive = isPreview ? ["https://vercel.live"] : [];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${vercelLive.join(" ")}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${vercelLive.join(" ")}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins.join(" ")} ${vercelLive.join(" ")}${isDev ? " ws:" : ""}`.replace(/\s+/g, " ").trim(),
  "worker-src 'self' blob:",
  `frame-src 'self' ${vercelLive.join(" ")}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Satu-satunya <Image> adalah logo PNG lokal. Mematikan optimizer menghapus
  // endpoint /_next/image yang punya beberapa advisory di Next 14.x
  // (DoS, cache growth, RCE via AVIF) yang baru di-fix di 15.5.x.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
