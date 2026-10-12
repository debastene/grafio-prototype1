/**
 * Helper route handler kuis: ambil Supabase client ber-sesi user + user id.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/db/supabase";
import { QuizError } from "./server";

export async function requireQuizUser(): Promise<{ sb: SupabaseClient; userId: string } | NextResponse> {
  const sb = getServerSupabase(cookies());
  if (!sb) {
    return NextResponse.json({ error: "Database belum di-setup", code: "db_unconfigured" }, { status: 503 });
  }
  const { data } = await sb.auth.getUser();
  if (!data?.user) {
    return NextResponse.json({ error: "Login dulu", code: "auth_required" }, { status: 401 });
  }
  return { sb: sb as unknown as SupabaseClient, userId: data.user.id };
}

export function quizErrorResponse(e: unknown): NextResponse {
  if (e instanceof QuizError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error("[quiz] unexpected", e);
  return NextResponse.json({ error: "Gagal memproses kuis.", code: "quiz_failed" }, { status: 500 });
}
