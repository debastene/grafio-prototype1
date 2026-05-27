"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import { Mail, Lock, Github, ArrowRight, AlertTriangle } from "lucide-react";
import { login } from "@/lib/auth/storage";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bgDeep flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan/15 blur-3xl rounded-full pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet/15 blur-3xl rounded-full pointer-events-none animate-float" style={{ animationDelay: "2s" }} />

      <div className="relative w-full max-w-md reveal">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 group">
          <Logo className="w-10 h-10 group-hover:scale-105 transition-transform duration-400 ease-glide" />
          <span className="font-syne font-extrabold text-2xl tracking-wide text-white group-hover:text-gradient transition-all duration-400 ease-glide">
            GRAFIO
          </span>
        </Link>

        <div className="glass-strong rounded-2xl p-8 shadow-elev-lg">
          <h1 className="text-2xl font-syne font-bold text-white mb-1">Selamat Datang Kembali</h1>
          <p className="text-sm text-muted mb-6">Login ke workspace Anda.</p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => alert("Google OAuth akan tersedia di production. Untuk sementara, daftar via /signup.")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-borderColor bg-bgSurface/60 backdrop-blur-sm text-white text-sm hover:border-cyan/55 hover:bg-cyan/5 transition-all duration-300 ease-glide"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              onClick={() => alert("GitHub OAuth akan tersedia di production. Untuk sementara, daftar via /signup.")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-borderColor bg-bgSurface/60 backdrop-blur-sm text-white text-sm hover:border-cyan/55 hover:bg-cyan/5 transition-all duration-300 ease-glide"
            >
              <Github className="w-4 h-4" /> GitHub
            </button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-borderColor" /></div>
            <div className="relative flex justify-center"><span className="bg-bgSurface px-3 text-xs text-muted">atau</span></div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs text-muted">Email</span>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kamu@email.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-bgSurface/70 backdrop-blur-sm border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/55 focus:bg-bgSurface focus:shadow-glow transition-all duration-250 ease-glide placeholder:text-muted/60"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Password</span>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-bgSurface/70 backdrop-blur-sm border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/55 focus:bg-bgSurface focus:shadow-glow transition-all duration-250 ease-glide placeholder:text-muted/60"
                />
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses…" : <>Login <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Belum punya akun?{" "}
            <Link href="/signup" className="text-cyan link-underline">
              Daftar gratis
            </Link>
            {" · "}
            <Link href="/trial" className="text-mint link-underline">
              Free Trial 7 hari
            </Link>
          </p>
          <p className="text-center text-[10px] text-muted/60 mt-3">
            Akun & project disimpan aman di cloud (Supabase).
          </p>
        </div>
      </div>
    </main>
  );
}
