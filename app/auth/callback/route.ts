/**
 * OAuth / email-confirmation callback handler.
 *
 * Supabase sends users here after they click the "Confirm email" link.
 * URL shape:  /auth/callback?code=<pkce_code>&next=/dashboard
 *
 * We exchange the code for a session (server-side, so the auth cookies are
 * set on the response), then redirect to `next` (defaults to /dashboard).
 *
 * If anything fails, redirect to /auth/verify?error=... so the user gets
 * a clear message instead of a blank page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorDescription = url.searchParams.get("error_description");

  // Build absolute URL for redirect (req.nextUrl preserves origin)
  const redirectTo = (path: string) => {
    const target = new URL(path, req.url);
    return NextResponse.redirect(target);
  };

  // If Supabase passed back an error in the link, surface it
  if (errorDescription) {
    return redirectTo(`/auth/verify?error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return redirectTo("/auth/verify?error=" + encodeURIComponent("Link tidak valid atau sudah kadaluarsa"));
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return redirectTo("/auth/verify?error=" + encodeURIComponent("Supabase belum di-setup"));
  }

  // We need to set cookies on the outgoing response. The trick: build the
  // response first as a redirect, then pass it to the cookies adapter so it
  // can mutate the response's Set-Cookie headers in-place.
  const res = NextResponse.redirect(new URL(next, req.url));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirectTo(`/auth/verify?error=${encodeURIComponent(error.message)}`);
  }

  // Success — session cookies are set on `res`, redirect to next destination.
  // We also pass `?verified=1` so /auth/verified page or downstream pages
  // can show a brief toast if they want.
  const successUrl = new URL(next, req.url);
  successUrl.searchParams.set("verified", "1");
  const successRes = NextResponse.redirect(successUrl);
  // Copy auth cookies from res to successRes
  for (const cookie of res.cookies.getAll()) {
    successRes.cookies.set(cookie);
  }
  return successRes;
}
