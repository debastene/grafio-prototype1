"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Menu, X, Sparkles, LogOut, User as UserIcon, FolderOpen, Trophy, Coins,
  ChevronDown, Brain, MessageSquare, Wand2, Eye, ShieldCheck, FileDown,
  LayoutDashboard, Rocket, Crown, GraduationCap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { getSession, logout, planLabel, refreshSession, UserProfile, getRemainingTrialDays } from "@/lib/auth/storage";
import { getBrowserSupabase } from "@/lib/db/supabase";
import MagneticButton from "./motion/MagneticButton";

type LinkItem = { label: string; href: string; mega?: "features" | "pricing" };

const links: LinkItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Quiz", href: "/quiz" },
  { label: "Features", href: "/features", mega: "features" },
  { label: "Pricing", href: "/pricing", mega: "pricing" },
  { label: "Contact", href: "/contact" },
];

// Mega-menu data (presentasi murni — semua href tetap mengacu ke route yang sudah ada).
const featuresMenu = {
  intro: {
    title: "Cara Grafio bekerja",
    desc: "AI yang minta konteks, cleaning per-anomali, kesimpulan bersudut pandang.",
    href: "/features",
  },
  groups: [
    {
      label: "By area",
      items: [
        { icon: Brain, label: "Konteks-Aware AI", href: "/features#flow-01", desc: "AI tanya dulu sebelum analisis" },
        { icon: Wand2, label: "Auto Cleaning", href: "/features#flow-02", desc: "Per-anomali, kamu yang putuskan" },
        { icon: MessageSquare, label: "Q&A Context-Aware", href: "/features#flow-04", desc: "Chat ingat seluruh konteks" },
      ],
    },
    {
      label: "By output",
      items: [
        { icon: Eye, label: "Anomaly Detection", href: "/features", desc: "Z-score, IQR, drift" },
        { icon: FileDown, label: "PDF & PPT Export", href: "/features", desc: "Laporan siap presentasi" },
        { icon: ShieldCheck, label: "Privacy by Design", href: "/security", desc: "Parsing di browser" },
      ],
    },
  ],
};

const pricingMenu = {
  intro: {
    title: "Pilih plan sesuai kebutuhan",
    desc: "Semua fitur saat ini gratis untuk early users. Billing segera dibuka.",
    href: "/pricing",
  },
  groups: [
    {
      label: "Plans",
      items: [
        { icon: Sparkles, label: "Free", href: "/pricing#free", desc: "3-5 prompt / 6 jam · selamanya" },
        { icon: GraduationCap, label: "Student", href: "/pricing#student", desc: "Rp 49k · paling populer" },
        { icon: Rocket, label: "Pro", href: "/pricing#pro", desc: "Rp 159k · semua fitur" },
        { icon: Crown, label: "Custom", href: "/pricing#custom", desc: "Enterprise · negosiasi" },
      ],
    },
  ],
};

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<"features" | "pricing" | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
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
      .then(({ data }: { data: { credits: number } | null }) => {
        if (data && typeof data.credits === "number") setCredits(data.credits);
      });
  }, [user, pathname]);

  // Close mega-menu on route change
  useEffect(() => {
    setMegaOpen(null);
    setMenuOpen(false);
    setOpen(false);
  }, [pathname]);

  const onLogout = async () => {
    await logout();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
  };

  const trialDays = user ? getRemainingTrialDays(user) : null;

  const openMega = (key: "features" | "pricing") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(key);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(null), 140);
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-400 ease-glide ${
        scrolled
          ? "backdrop-blur-xl bg-bgDeep/80 border-b border-borderColor shadow-soft"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo className="w-9 h-9 group-hover:scale-105 transition-transform duration-400 ease-glide" />
          <span className="font-syne font-extrabold text-xl tracking-wide text-white group-hover:text-gradient transition-all duration-400 ease-glide">
            GRAFIO
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            const hasMega = !!l.mega;
            return (
              <div
                key={l.href}
                className="relative"
                onMouseEnter={hasMega ? () => openMega(l.mega!) : undefined}
                onMouseLeave={hasMega ? scheduleClose : undefined}
              >
                <Link
                  href={l.href}
                  className={`relative text-sm px-3 py-2 rounded-md transition-colors duration-250 ease-glide inline-flex items-center gap-1 ${
                    active ? "text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {l.label}
                  {hasMega && (
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-250 ${
                        megaOpen === l.mega ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {active && (
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-1 h-1 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                  )}
                </Link>
              </div>
            );
          })}
          <span className="w-px h-5 bg-borderColor mx-3" />

          {user ? (
            <div className="relative flex items-center gap-2">
              {credits !== null && credits > 0 && (
                <Link
                  href="/quiz"
                  title={`${credits} credits dari quiz`}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-warning/30 bg-warning/10 hover:bg-warning/20 transition-colors duration-250"
                >
                  <Coins className="w-3 h-3 text-warning" />
                  <span className="text-[11px] font-syne font-bold text-warning">{credits}</span>
                </Link>
              )}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-borderColor bg-bgSurface/80 backdrop-blur-sm hover:border-cyan/40 transition-all duration-250 ease-glide"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan to-violet flex items-center justify-center text-bgDeep font-bold text-[10px]">
                  {user.name[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-white">{user.name.split(" ")[0]}</span>
                <span className="text-[10px] uppercase tracking-widest text-cyan bg-cyan/10 px-1.5 py-0.5 rounded">
                  {planLabel(user.plan)}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 glass-strong rounded-xl shadow-elev-lg p-2 z-10 animate-fadeUp">
                  <div className="px-3 py-2.5 border-b border-borderColor">
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
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted hover:bg-bgElevated hover:text-white transition-colors duration-250"
                  >
                    <UserIcon className="w-3.5 h-3.5" /> Dashboard
                  </Link>
                  <Link
                    href="/projects"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted hover:bg-bgElevated hover:text-white transition-colors duration-250"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Project History
                  </Link>
                  <Link
                    href="/quiz"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted hover:bg-bgElevated hover:text-white transition-colors duration-250"
                  >
                    <Trophy className="w-3.5 h-3.5" /> Mini Quiz
                  </Link>
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-danger hover:bg-bgElevated transition-colors duration-250"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm text-muted hover:text-white transition-colors duration-250 px-3 py-2"
              >
                Login
              </Link>
              <MagneticButton strength={0.18}>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-md bg-cyan text-bgDeep font-semibold text-sm hover:bg-cyanSoft transition-all duration-250 ease-glide flex items-center gap-1.5 shadow-glow hover:shadow-glow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Coba Gratis
                </Link>
              </MagneticButton>
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

      {/* MEGA-MENU PANEL ============================================ */}
      <div
        className={`hidden md:block absolute left-0 right-0 top-full transition-all duration-400 ease-glide ${
          megaOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
        onMouseEnter={() => megaOpen && openMega(megaOpen)}
        onMouseLeave={scheduleClose}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="glass-strong rounded-2xl shadow-elev-lg overflow-hidden border border-borderColorStrong">
            <div className="grid lg:grid-cols-[1.1fr_2fr] divide-x divide-borderColor">
              {/* INTRO */}
              <div className="p-7 bg-gradient-to-br from-cyan/5 via-transparent to-violet/5 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan/20 blur-3xl rounded-full" />
                <p className="relative text-[10px] uppercase tracking-[0.25em] text-cyan font-mono mb-3">
                  {megaOpen === "features" ? "Features" : "Pricing"}
                </p>
                <p className="relative font-syne font-bold text-white text-xl leading-tight mb-2">
                  {megaOpen === "features"
                    ? featuresMenu.intro.title
                    : pricingMenu.intro.title}
                </p>
                <p className="relative text-sm text-muted leading-relaxed mb-5">
                  {megaOpen === "features"
                    ? featuresMenu.intro.desc
                    : pricingMenu.intro.desc}
                </p>
                <Link
                  href={megaOpen === "features" ? featuresMenu.intro.href : pricingMenu.intro.href}
                  className="relative inline-flex items-center gap-1.5 text-cyan text-sm font-medium link-underline"
                  onClick={() => setMegaOpen(null)}
                >
                  Lihat semua →
                </Link>
              </div>

              {/* GROUPS */}
              <div className="p-7 grid sm:grid-cols-2 gap-x-6 gap-y-5">
                {(megaOpen === "features" ? featuresMenu.groups : pricingMenu.groups).map((g) => (
                  <div key={g.label}>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted font-mono mb-3">
                      {g.label}
                    </p>
                    <ul className="space-y-1">
                      {g.items.map((it) => (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            onClick={() => setMegaOpen(null)}
                            className="group flex items-start gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-bgElevated/60 transition-all duration-250 ease-glide"
                          >
                            <div className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/25 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan/20 group-hover:border-cyan/40 transition-all duration-250">
                              <it.icon className="w-4 h-4 text-cyan" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white group-hover:text-cyan transition-colors duration-250">
                                {it.label}
                              </p>
                              <p className="text-xs text-muted leading-relaxed mt-0.5">
                                {it.desc}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-borderColor bg-bgDeep/95 backdrop-blur-xl">
          <div className="flex flex-col px-6 py-5 gap-4">
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
