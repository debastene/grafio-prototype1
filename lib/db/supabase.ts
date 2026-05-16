/**
 * Supabase client factory.
 *
 * Two flavors:
 *   - browser:  for use inside "use client" components / event handlers
 *   - server:   for use in server components, route handlers, middleware
 *
 * Both pick up NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
 * If env vars are missing, exports a "stub" mode flag so the UI can gracefully
 * degrade instead of throwing on import.
 */

import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_CONFIGURED =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Browser-side client. Safe to call from "use client" components.
 * Returns null if env vars are missing — caller should handle.
 *
 * NOTE: We intentionally use the untyped variant. Row shapes are validated
 * manually via the types in `./types.ts` at call sites.
 */
export function getBrowserSupabase() {
  if (!SUPABASE_CONFIGURED) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Server-side client. For server components, route handlers, middleware.
 */
export function getServerSupabase(cookies: {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options: CookieOptions) => void;
  remove?: (name: string, options: CookieOptions) => void;
}) {
  if (!SUPABASE_CONFIGURED) return null;
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookies.set?.(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookies.remove?.(name, options);
      },
    },
  });
}
