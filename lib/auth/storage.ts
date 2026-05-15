/**
 * Auth prototype — localStorage-based session.
 *
 * In production this would be replaced with proper backend auth (Supabase /
 * NextAuth / Auth0 / custom DB). For prototype, we persist to localStorage
 * so users can sign up + log in + see their session across reloads.
 *
 * Each user record:
 *   - email (unique key)
 *   - hashed password (lightweight — NOT cryptographically secure for production)
 *   - profile fields (name, phone, social, plan-specific fields)
 *   - plan: free | trial | student | pro | custom
 *   - createdAt, trialEndsAt
 *
 * Session: stored separately as { email, loginAt }.
 */

export type Plan = "free" | "trial" | "student" | "pro" | "custom";

export type UserProfile = {
  email: string;
  name: string;
  passwordHash: string;
  plan: Plan;
  createdAt: string; // ISO
  // Trial
  trialEndsAt?: string;
  // Common optional
  phone?: string;
  socialMedia?: string;
  // Student-specific
  nrp?: string;
  institution?: string;
};

const USERS_KEY = "grafio.users";
const SESSION_KEY = "grafio.session";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Lightweight non-crypto hash for prototype demo only.
 */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // Convert to unsigned + base36
  return (h >>> 0).toString(36) + input.length.toString(36);
}

function loadUsers(): Record<string, UserProfile> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, UserProfile>): void {
  if (!isBrowser()) return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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
  | { ok: true; user: UserProfile }
  | { ok: false; error: string };

export function signup(input: SignupInput): SignupResult {
  if (!isBrowser()) return { ok: false, error: "Browser-only" };
  const users = loadUsers();
  const email = input.email.trim().toLowerCase();

  if (!email || !input.password || !input.name) {
    return { ok: false, error: "Email, password, dan nama wajib diisi." };
  }
  if (users[email]) {
    return { ok: false, error: "Email sudah terdaftar. Coba login." };
  }

  // Plan-specific validation
  if (input.plan === "trial") {
    if (!input.phone || !input.socialMedia) {
      return { ok: false, error: "Nomor HP dan link sosmed wajib untuk Free Trial." };
    }
  }
  if (input.plan === "student") {
    if (!input.nrp || !input.institution) {
      return { ok: false, error: "NRP dan nama institusi wajib untuk Student plan." };
    }
  }

  const now = new Date();
  const trialEnds =
    input.plan === "trial"
      ? new Date(now.getTime() + (input.trialDays ?? 7) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

  const user: UserProfile = {
    email,
    name: input.name,
    passwordHash: hash(input.password),
    plan: input.plan,
    createdAt: now.toISOString(),
    trialEndsAt: trialEnds,
    phone: input.phone,
    socialMedia: input.socialMedia,
    nrp: input.nrp,
    institution: input.institution,
  };

  users[email] = user;
  saveUsers(users);
  setSession(email);
  return { ok: true, user };
}

export type LoginResult =
  | { ok: true; user: UserProfile }
  | { ok: false; error: string };

export function login(email: string, password: string): LoginResult {
  if (!isBrowser()) return { ok: false, error: "Browser-only" };
  const users = loadUsers();
  const key = email.trim().toLowerCase();
  const user = users[key];
  if (!user) return { ok: false, error: "Email tidak ditemukan." };
  if (user.passwordHash !== hash(password)) {
    return { ok: false, error: "Password salah." };
  }
  setSession(user.email);
  return { ok: true, user };
}

export function logout(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
}

export function setSession(email: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ email, loginAt: new Date().toISOString() }),
  );
}

export function getSession(): UserProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { email } = JSON.parse(raw) as { email: string };
    const users = loadUsers();
    return users[email] ?? null;
  } catch {
    return null;
  }
}

export function getRemainingTrialDays(user: UserProfile): number | null {
  if (user.plan !== "trial" || !user.trialEndsAt) return null;
  const ms = new Date(user.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
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
