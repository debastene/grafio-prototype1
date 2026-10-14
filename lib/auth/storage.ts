/**
 * Supabase-backed auth.
 *
 * Same API as the old localStorage prototype so existing pages keep working:
 *   - signup(input)
 *   - login(email, password)
 *   - logout()
 *   - getSession() → cached snapshot for client components
 *   - getRemainingTrialDays(user)
 *   - planLabel(plan)
 *
 * Network calls are async (signup/login/logout). getSession() reads from a
 * sessionStorage cache that's populated on signup/login. For source-of-truth
 * data prefer the live profile fetch helpers in lib/db/profiles.
 *
 * Falls back to a clear error if Supabase env vars aren't configured.
 */

import { getBrowserSupabase, SUPABASE_CONFIGURED } from "@/lib/db/supabase";
import type { ProfileRow, Plan } from "@/lib/db/types";

export type { Plan };

// Keep the legacy UserProfile shape (camelCase) so callers don't break.
export type UserProfile = {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  /** Plan yang diminta saat signup — paid plan menunggu verifikasi/pembayaran. */
  requestedPlan?: Plan;
  createdAt: string;
  trialEndsAt?: string;
  phone?: string;
  socialMedia?: string;
  nrp?: string;
  institution?: string;
};

/**
 * Signup hanya boleh menghasilkan plan gratis. Paid plan (student/pro/custom)
 * di-clamp ke 'free' — server-side trigger (supabase/schema.sql) juga
 * melakukan clamp yang sama; ini sekadar menjaga UI konsisten dengan DB.
 */
function clampSignupPlan(plan: Plan): Plan {
  return plan === "trial" ? "trial" : "free";
}

const CACHE_KEY = "grafio.session.cache";

/**
 * Minimal panjang password. Samakan dengan Supabase → Authentication →
 * Providers → Email → "Minimum password length" (default Supabase hanya 6).
 */
export const MIN_PASSWORD_LENGTH = 8;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function rowToProfile(r: ProfileRow): UserProfile {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    requestedPlan: r.requested_plan ?? r.plan,
    createdAt: r.created_at,
    trialEndsAt: r.trial_ends_at ?? undefined,
    phone: r.phone ?? undefined,
    socialMedia: r.social_media ?? undefined,
    nrp: r.nrp ?? undefined,
    institution: r.institution ?? undefined,
  };
}

function setCache(p: UserProfile): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function readCache(): UserProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function clearCache(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// =============================================================================
// SIGNUP
// =============================================================================

export type SignupInput = {
  email: string;
  password: string;
  name: string;
  plan: Plan;
  phone?: string;
  socialMedia?: string;
  nrp?: string;
  institution?: string;
  trialDays?: number;
};

export type SignupResult =
  | { ok: true; user: UserProfile; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

export async function signup(input: SignupInput): Promise<SignupResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error:
        "Database belum di-setup. Hubungi admin atau lihat README.md untuk panduan setup Supabase.",
    };
  }
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };

  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || !input.name) {
    return { ok: false, error: "Email, password, dan nama wajib diisi." };
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` };
  }

  // Plan-specific validation
  if (input.plan === "trial" && (!input.phone || !input.socialMedia)) {
    return { ok: false, error: "Nomor HP dan link sosmed wajib untuk Free Trial." };
  }
  if (input.plan === "student" && (!input.nrp || !input.institution)) {
    return { ok: false, error: "NRP dan nama institusi wajib untuk Student plan." };
  }

  // Plan efektif setelah clamp — DB trigger melakukan hal yang sama server-side.
  const effectivePlan = clampSignupPlan(input.plan);

  const trialDays = input.trialDays ?? 7;
  const trialEndsAt =
    effectivePlan === "trial"
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

  // Build callback URL pointing to our /auth/callback route. Supabase email
  // template uses {{ .ConfirmationURL }} which honors this redirect.
  const origin = isBrowser() ? window.location.origin : "";
  const emailRedirectTo = `${origin}/auth/callback?next=/dashboard`;

  // Supabase auth signup. user_metadata is read by handle_new_user() trigger
  // which creates the matching profile row. NOTE: `plan` di metadata hanyalah
  // REQUEST — trigger meng-clamp ke free/trial dan menyimpan aslinya di
  // profiles.requested_plan untuk follow-up admin (verifikasi/pembayaran).
  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        name: input.name,
        plan: input.plan,
        phone: input.phone,
        social_media: input.socialMedia,
        nrp: input.nrp,
        institution: input.institution,
        trial_ends_at: trialEndsAt,
      },
    },
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }
  if (!data.user) {
    return { ok: false, error: "Signup gagal — coba lagi." };
  }

  // When Supabase has email confirmation enabled, data.session === null until
  // the user clicks the confirmation link. We use this signal to redirect to
  // the verify-email page instead of dropping them on /dashboard.
  const needsEmailConfirmation = !data.session;

  // Build the UserProfile from the data we know (trigger creates DB row async).
  const profile: UserProfile = {
    id: data.user.id,
    email,
    name: input.name,
    plan: effectivePlan,
    requestedPlan: input.plan,
    createdAt: data.user.created_at ?? new Date().toISOString(),
    trialEndsAt,
    phone: input.phone,
    socialMedia: input.socialMedia,
    nrp: input.nrp,
    institution: input.institution,
  };

  // Only cache the session when user is actually logged in (no confirmation pending).
  if (!needsEmailConfirmation) {
    setCache(profile);
  }
  return { ok: true, user: profile, needsEmailConfirmation };
}

// =============================================================================
// LOGIN
// =============================================================================

export type LoginResult =
  | { ok: true; user: UserProfile }
  | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error:
        "Database belum di-setup. Hubungi admin atau lihat README.md untuk panduan setup Supabase.",
    };
  }
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };

  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }
  if (!data.user) {
    return { ok: false, error: "Login gagal — coba lagi." };
  }

  // Fetch the matching profile row
  const { data: profileRow, error: profileErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileErr || !profileRow) {
    // Profile not yet created (trigger lag?) — synthesize from auth user
    const fallback: UserProfile = {
      id: data.user.id,
      email: data.user.email ?? cleanEmail,
      name: (data.user.user_metadata?.name as string) ?? cleanEmail.split("@")[0],
      // metadata.plan tidak dipercaya — clamp sama seperti DB trigger
      plan: clampSignupPlan((data.user.user_metadata?.plan as Plan) ?? "free"),
      createdAt: data.user.created_at ?? new Date().toISOString(),
    };
    setCache(fallback);
    return { ok: true, user: fallback };
  }

  const profile = rowToProfile(profileRow);
  setCache(profile);
  return { ok: true, user: profile };
}

// =============================================================================
// LOGOUT
// =============================================================================

export async function logout(): Promise<void> {
  clearCache();
  const sb = getBrowserSupabase();
  if (sb) await sb.auth.signOut();
}

// =============================================================================
// SESSION
// =============================================================================

/**
 * Synchronous getter — returns cached profile from sessionStorage.
 * For SSR-safe reads or fresh checks, use refreshSession().
 */
export function getSession(): UserProfile | null {
  return readCache();
}

/**
 * Refresh the cached profile from Supabase. Call this on mount of pages
 * that need an authoritative session (e.g. dashboard, projects).
 */
export async function refreshSession(): Promise<UserProfile | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data: authData } = await sb.auth.getUser();
  if (!authData.user) {
    clearCache();
    return null;
  }
  const { data: profileRow } = await sb
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();
  if (!profileRow) return null;
  const profile = rowToProfile(profileRow);
  setCache(profile);
  return profile;
}

// =============================================================================
// HELPERS
// =============================================================================

export function getRemainingTrialDays(user: UserProfile): number | null {
  if (user.plan !== "trial" || !user.trialEndsAt) return null;
  const ms = new Date(user.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Resend the email confirmation link to the given address.
 * Returns ok:true even if the user is already confirmed (Supabase treats it as no-op).
 */
export async function resendConfirmation(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: "Database belum di-setup." };
  const sb = getBrowserSupabase();
  if (!sb) return { ok: false, error: "Supabase client unavailable." };
  const origin = isBrowser() ? window.location.origin : "";
  const { error } = await sb.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

export function planLabel(plan: Plan): string {
  switch (plan) {
    case "free": return "Free";
    case "trial": return "Free Trial Student";
    case "student": return "Student";
    case "pro": return "Pro";
    case "custom": return "Custom";
  }
}

function friendlyAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("already registered")) return "Email sudah terdaftar. Coba login.";
  if (lower.includes("invalid login")) return "Email atau password salah.";
  if (lower.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Cek inbox untuk link verifikasi.";
  if (lower.includes("password should be at least"))
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  if (lower.includes("network") || lower.includes("fetch"))
    return "Koneksi bermasalah. Coba lagi.";
  return msg;
}
