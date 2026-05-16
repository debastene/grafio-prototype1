/**
 * Projects CRUD against Supabase.
 *
 * The full EngineResult can be large (10k rows in tableSnapshot). Before save,
 * we trim it down to a "snapshot" that's enough to re-render the dashboard:
 *   - tableSnapshot.rows → first 100 only
 *   - profile arrays → strip numericVector (raw arrays of full data)
 *
 * Result size after trim: typically 30-200 KB per project (well within Postgres JSONB limits).
 */

import { getBrowserSupabase, SUPABASE_CONFIGURED } from "./supabase";
import type { ProjectRow, Json } from "./types";
import type { EngineResult } from "@/lib/engine";

export type ProjectListItem = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "file_name"
  | "domain_id"
  | "domain_name"
  | "domain_emoji"
  | "row_count"
  | "column_count"
  | "health_score"
  | "summary"
  | "conclusion"
  | "thumbnail"
  | "created_at"
  | "updated_at"
>;

// =============================================================================
// SAVE
// =============================================================================

/**
 * Trim an EngineResult down to a storage-friendly snapshot.
 * The trimmed snapshot is enough to re-render the dashboard view but smaller.
 *
 * Returns a JSON-serializable structure cast to `Json` for Supabase typing.
 */
function trimSnapshot(result: EngineResult): Json {
  const trimmed = {
    ...result,
    tableSnapshot: {
      headers: result.tableSnapshot.headers,
      rows: result.tableSnapshot.rows.slice(0, 100),
    },
    profile: result.profile.map((p) => ({
      ...p,
      // Drop heavy fields not used by dashboard rendering
      numericVector: undefined,
    })),
  };
  return JSON.parse(JSON.stringify(trimmed)) as Json;
}

/** Build an 8-point sparkline from the primary chart's first series for thumbnails. */
function buildThumbnail(result: EngineResult): number[] | null {
  const primary = result.charts?.primary;
  if (!primary || !primary.series?.length) return null;
  const data = primary.series[0].data;
  if (!data?.length) return null;
  // Sample to 8 evenly-spaced points
  const out: number[] = [];
  const step = Math.max(1, Math.floor(data.length / 8));
  for (let i = 0; i < 8 && i * step < data.length; i++) {
    const v = data[i * step];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out.length >= 3 ? out : null;
}

export type SaveProjectInput = {
  name?: string; // defaults to file name
  result: EngineResult;
};

export type SaveProjectResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveProject(input: SaveProjectInput): Promise<SaveProjectResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: "Database belum di-setup. Lihat README.md untuk panduan Supabase setup.",
    };
  }
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };

  const { data: authData } = await sb.auth.getUser();
  if (!authData.user) {
    return { ok: false, error: "Login dulu untuk save project." };
  }

  const r = input.result;
  const name = input.name?.trim() || r.fileName.replace(/\.[^.]+$/, "");

  const insertRow = {
    user_id: authData.user.id,
    name,
    file_name: r.fileName,
    domain_id: r.domain.id ?? "generic",
    domain_name: r.domain.name ?? "Generic",
    domain_emoji: r.domain.emoji ?? "📊",
    row_count: r.rowCount,
    column_count: r.columnCount,
    health_score: r.cleaning?.healthScoreAfter ?? null,
    summary: r.summary?.slice(0, 1000) ?? "",
    conclusion: r.conclusion?.slice(0, 1500) ?? null,
    thumbnail: buildThumbnail(r),
    snapshot: trimSnapshot(r),
  };

  const { data, error } = await sb
    .from("projects")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id: string }).id };
}

// =============================================================================
// LIST
// =============================================================================

export async function listProjects(): Promise<ProjectListItem[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = getBrowserSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("projects")
    .select(
      "id, name, file_name, domain_id, domain_name, domain_emoji, row_count, column_count, health_score, summary, conclusion, thumbnail, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ProjectListItem[];
}

// =============================================================================
// GET
// =============================================================================

export async function getProject(id: string): Promise<ProjectRow | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as ProjectRow;
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteProject(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: "Database belum di-setup." };
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =============================================================================
// RENAME
// =============================================================================

export async function renameProject(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: "Database belum di-setup." };
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: "Nama tidak boleh kosong." };
  const { error } = await sb
    .from("projects")
    .update({ name: cleanName })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
