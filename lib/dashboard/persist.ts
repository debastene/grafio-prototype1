/**
 * Persist & restore Dashboard state across page refresh.
 *
 * Disimpan di sessionStorage (bukan localStorage) supaya:
 *   - Hilang saat user tutup tab — kerjaan kemarin tidak nempel di tab baru
 *   - Per-tab isolation — user bisa kerja 2 dataset di 2 tab tanpa overlap
 *
 * `files: File[]` TIDAK di-persist (browser security — File object tidak
 * serializable). Setelah refresh user gak bisa re-upload pakai instance
 * lama, tapi karena aiResult sudah punya tableSnapshot, dashboard tetap
 * render penuh tanpa file.
 *
 * Size guard: tableSnapshot.rows di-cap ke MAX_ROWS supaya tidak meledak
 * sessionStorage quota (~5MB).
 */

import type { EngineResult } from "@/lib/engine";

const KEY = "grafio.dashboard.snapshot.v1";
const MAX_ROWS = 200; // cukup untuk preview + chart re-render, hemat storage

export type PersistedState = {
  /** Versi data — bump kalau struktur EngineResult berubah, supaya stale snapshot di-discard. */
  v: 1;
  /** Trimmed EngineResult untuk hemat storage. */
  result: EngineResult;
  /** ISO timestamp saat di-save (untuk debug + future TTL kalau perlu). */
  savedAt: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

/**
 * Simpan aiResult ke sessionStorage. Aman dipanggil dari SSR (no-op di server).
 */
export function persistDashboard(result: EngineResult): void {
  if (!isBrowser()) return;
  try {
    const trimmed: EngineResult = {
      ...result,
      tableSnapshot: {
        headers: result.tableSnapshot.headers,
        rows: result.tableSnapshot.rows.slice(0, MAX_ROWS),
      },
    };
    const payload: PersistedState = {
      v: 1,
      result: trimmed,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    // QuotaExceededError atau JSON cycle — silently fail, dashboard tetap jalan
    // tanpa persistence.
    console.warn("[persistDashboard] gagal save:", e);
  }
}

/**
 * Load aiResult dari sessionStorage. Return null kalau tidak ada / corrupt /
 * versi mismatch.
 */
export function loadDashboard(): EngineResult | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.v !== 1) {
      // Schema lama — discard
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

/**
 * Hapus snapshot. Panggil saat user pencet "Reset" di dashboard.
 */
export function clearDashboard(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
