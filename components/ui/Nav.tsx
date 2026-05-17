"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Sparkles, LogOut, User as UserIcon, FolderOpen, Trophy, Coins } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { getSession, logout, planLabel, refreshSession, UserProfile, getRemainingTrialDays } from "@/lib/auth/storage";
import { getBrowserSupabase } from "@/lib/db/supabase";

const links = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Quiz", href: "/quiz" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Hydrate from cache immediately, then refresh from Supabase in background.
    setUser(getSession());
    refreshSession().then((fresh) => setUser(fresh));
    const onStorage = () => setUser(getSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  // Fetch credits balance setiap kali user / pathname berubah (auto-refresh
  // setelah submit quiz misal user balik ke dashboard).
  useEffect(() => {
    if (!user) {
      setCredits(null);
      return;
    }
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data && typeof data.credits === "number") setCredits(data.credits);
      });
  }, [user, pathname]);

  const onLogout = async () => {
    await logout();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
  };

  const trialDays = user ? getRemainingTrialDays(user) : null;

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-bgDeep/85 border-b border-borderColor shadow-soft"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo className="w-9 h-9 group-hover:scale-105 transition-transform duration-300" />
          <span className="font-syne font-extrabold text-xl tracking-wide text-white group-hover:text-gradient transition-all">
            GRAFIO
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative text-sm px-3 py-2 rounded-md transition-colors ${
                  active ? "text-white" : "text-muted hover:text-white"
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-1 h-1 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                )}
              </Link>
            );
          })}
          <span className="w-px h-5 bg-borderColor mx-3" />

          {user ? (
            <div className="relative flex items-center gap-2">
              {credits !== null && credits > 0 && (
                <Link
                  href="/quiz"
                  title={`${credits} credits dari quiz`}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-warning/30 bg-warning/10 hover:bg-warning/20 transition-colors"
                >
                  <Coins className="w-3 h-3 text-warning" />
                  <span className="text-[11px] font-syne font-bold text-warning">{credits}</span>
                </Link>
              )}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-borderColor bg-bgSurface hover:border-cyan/40 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan to-purple flex items-center justify-center text-bgDeep font-bold text-[10px]">
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-white">{user.name.split(" ")[0]}</span>
                <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-1.5 py-0.5 rounded">
                  {planLabel(user.plan)}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-bgSurface border border-borderColor rounded-md shadow-soft p-2 z-10">
                  <div className="px-3 py-2 border-b border-borderColor">
                    <p className="text-xs text-white font-semibold truncate">{user.name}</p>
                    <p className="text-[10px] text-muted truncate">{user.email}</p>
                    {trialDays !== null && (
                      <p className="text-[10px] text-mint mt-1">
                        Trial sisa: {trialDays} hari
                      </p>
                    )}
                    {credits !== null && (
                      <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                        <Coins className="w-2.5 h-2.5" /> {credits} credits
                      </p>
                    )}
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-muted hover:bg-bgElevated hover:text-white"
                  >
                    <UserIcon className="w-3.5 h-3.5" /> Dashboard
                  </Link>
                  <Link
                    href="/projects"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-muted hover:bg-bgElevated hover:text-white"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Project History
                  </Link>
                  <Link
                    href="/quiz"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-muted hover:bg-bgElevated hover:text-white"
                  >
                    <Trophy className="w-3.5 h-3.5" /> Mini Quiz
                  </Link>
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-danger hover:bg-bgElevated"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm text-muted hover:text-white transition-colors px-3 py-2"
              >
                Login
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-md bg-cyan text-bgDeep font-semibold text-sm hover:bg-cyanSoft hover:scale-[1.03] transition-all flex items-center gap-1.5 shadow-glow"
              >
                <Sparkles className="w-3.5 h-3.5" /> Coba Gratis
              </Link>
            </div>
          )}
        </div>

        <button
          aria-label="Menu"
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-white"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-borderColor bg-bgDeep/95 backdrop-blur-xl">
          <div className="flex flex-col px-6 py-4 gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`text-sm ${pathname === l.href ? "text-cyan" : "text-muted"}`}
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <p className="text-xs text-white">
                  {user.name} <span className="text-cyan ml-1">{planLabel(user.plan)}</span>
                </p>
                <Link
                  href="/projects"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted flex items-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Project History
                </Link>
                <button
                  onClick={onLogout}
                  className="text-sm text-danger text-left flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="text-sm text-muted">
                  Login
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-md bg-cyan text-bgDeep font-semibold text-sm text-center"
                >
                  Coba Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
