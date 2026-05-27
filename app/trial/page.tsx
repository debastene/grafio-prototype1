"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import {
  Mail, Lock, User, Phone, AtSign, ArrowRight, Check, AlertTriangle, Gift,
} from "lucide-react";
import { signup } from "@/lib/auth/storage";

export default function TrialPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    socialMedia: "",
    agree: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.agree) {
      setError("Setujui Terms & Privacy dulu.");
      return;
    }
    setLoading(true);
    try {
      const res = await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        plan: "trial",
        phone: form.phone,
        socialMedia: form.socialMedia,
        trialDays: 7,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.needsEmailConfirmation) {
        router.push(`/auth/verify?email=${encodeURIComponent(form.email)}`);
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bgDeep flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-mint/15 blur-3xl rounded-full pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan/15 blur-3xl rounded-full pointer-events-none animate-float" style={{ animationDelay: "2s" }} />

      <div className="relative w-full max-w-md reveal">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 group">
          <Logo className="w-10 h-10 group-hover:scale-105 transition-transform duration-400 ease-glide" />
          <span className="font-syne font-extrabold text-2xl tracking-wide text-white group-hover:text-gradient transition-all duration-400 ease-glide">
            GRAFIO
          </span>
        </Link>

        <div className="glass-strong rounded-2xl p-8 shadow-elev-lg">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-5 h-5 text-mint" />
            <h1 className="text-2xl font-syne font-bold text-white">Free Trial — 7 Hari</h1>
          </div>
          <p className="text-sm text-muted mb-5">
            Akses semua fitur paket <span className="text-cyan font-semibold">Student</span> selama 7 hari, gratis. Tanpa kartu kredit.
          </p>

          <ul className="space-y-1.5 text-[11px] text-muted bg-bgSurface/40 rounded-md p-3 mb-5 border border-borderColor">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint flex-shrink-0" /> 20-30 prompt analisis per 6 jam</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint flex-shrink-0" /> Multi-file upload (max 3)</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint flex-shrink-0" /> Output detail tanpa watermark</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint flex-shrink-0" /> Auto-cleaning + correlation matrix</li>
          </ul>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field icon={User} label="Nama lengkap" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field icon={Mail} label="Email aktif" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required placeholder="kamu@email.com" />
            <Field icon={Lock} label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required minLength={6} />
            <Field icon={Phone} label="Nomor HP" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="+62 812-..." />
            <Field icon={AtSign} label="Sosial Media" value={form.socialMedia} onChange={(v) => setForm({ ...form, socialMedia: v })} required placeholder="@username (IG / TikTok / lainnya)" />

            <label className="flex items-start gap-2 text-xs text-muted pt-2">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                className="accent-cyan mt-0.5"
              />
              Saya menyetujui{" "}
              <Link href="/terms" className="text-cyan hover:underline">Terms</Link> dan{" "}
              <Link href="/privacy" className="text-cyan hover:underline">Privacy</Link>. Saya paham trial otomatis berakhir setelah 7 hari.
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aktivasi trial…" : (
                <>
                  Klaim 7 Hari Gratis <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-5">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-cyan hover:underline">Login</Link>
            {" · "}
            <Link href="/signup" className="text-cyan hover:underline">Plan reguler</Link>
          </p>
          <p className="text-center text-[10px] text-muted/60 mt-3">
            Prototype: data tersimpan di localStorage browser ini.
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon: Icon, label, value, onChange, type = "text", required = false, minLength, placeholder,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1 relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type={type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-3 py-2.5 bg-bgSurface/70 backdrop-blur-sm border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/55 focus:bg-bgSurface focus:shadow-glow transition-all duration-250 ease-glide placeholder:text-muted/60"
        />
      </div>
    </label>
  );
}
