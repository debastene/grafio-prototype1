/**
 * Validasi parameter `?next=` supaya hanya path INTERNAL yang diterima.
 *
 * Tanpa ini, /auth/callback?next=https://situs-jahat.com (atau //situs-jahat.com,
 * /\situs-jahat.com) mengarahkan user yang baru login ke domain lain — open
 * redirect yang lazim dipakai untuk phishing.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  // Harus path absolut tunggal: "/x", bukan "//host", "/\host", "http:", "javascript:".
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(decoded)) return fallback;
  try {
    const u = new URL(decoded, "https://internal.invalid");
    if (u.origin !== "https://internal.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
