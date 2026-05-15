"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import {
  Mail, Lock, User, ArrowRight, Check, Building2, Hash, AlertTriangle, Sparkles,
} from "lucide-react";
import { signup, Plan } from "@/lib/auth/storage";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPlan = (params.get("plan") as Plan) || "free";

  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    nrp: "",
    institution: "",
    agree: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromUrl = params.get("plan") as Plan;
    if (fromUrl && ["free", "student", "pro", "custom"].includes(fromUrl)) {
      setPlan(fromUrl);
    }
  }, [params]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.agree) {
      setError("Setujui Terms & Privacy dulu.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = signup({
        name: form.name,
        email: form.email,
        password: form.password,
        plan,
        nrp: plan === "student" ? form.nrp : undefined,
        institution: plan === "student" ? form.institution : undefined,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/dashboard");
    }, 400);
  };

  const planMeta: Record<Plan, { label: string; price: string; emoji: string }> = {
    free: { label: "Free", price: "Rp 0/bulan", emoji: "✨" },
    trial: { label: "Free Trial", price: "7 hari gratis", emoji: "🎁" },
    student: { label: "Student", price: "Rp 49.000/bulan", emoji: "🎓" },
    pro: { label: "Pro", price: "Rp 159.000/bulan", emoji: "🚀" },
    custom: { label: "Custom", price: "Hubungi sales", emoji: "👑" },
  };

  return (
    <main className="min-h-screen bg-bgDeep flex items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 group">
          <Logo className="w-10 h-10 text-silver group-hover:text-cyan transition-colors" />
          <span className="font-syne font-extrabold text-2xl tracking-wide text-white">
            GRAFIO
          </span>
        </Link>

        <div className="glass rounded-2xl p-8 shadow-soft">
          <h1 className="text-2xl font-syne font-bold text-white mb-1">Buat Akun Grafio</h1>
          <p className="text-sm text-muted mb-5">
            Pilih plan, lengkapi data, mulai analisis dalam 30 detik.
          </p>

          {/* Plan picker */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {(["free", "student", "pro"] as Plan[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={`text-left rounded-md border p-2.5 transition-all ${
                  plan === p
                    ? "border-cyan bg-cyan/10"
                    : "border-borderColor bg-bgSurface hover:border-cyan/50"
                }`}
              >
                <p className="text-xs">{planMeta[p].emoji}</p>
                <p className="text-[11px] font-syne font-bold text-white">{planMeta[p].label}</p>
                <p className="text-[10px] text-muted">{planMeta[p].price}</p>
              </button>
            ))}
          </div>
          {plan === "custom" && (
            <p className="text-xs text-muted bg-bgSurface border border-borderColor rounded-md p-3 mb-4">
              Untuk Custom plan,{" "}
              <Link href="/contact#sales" className="text-cyan hover:underline">
                hubungi tim sales
              </Link>
              .
            </p>
          )}
          <p className="text-[11px] text-muted mb-4">
            Mau coba dulu?{" "}
            <Link href="/trial" className="text-mint hover:underline">
              Free Trial Student 7 hari
            </Link>
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field icon={User} label="Nama lengkap" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field icon={Mail} label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Field icon={Lock} label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required minLength={6} />

            {/* Student-specific fields */}
            {plan === "student" && (
              <>
                <div className="text-[11px] text-cyan bg-cyan/5 border border-cyan/30 rounded-md p-2 my-2 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Plan Student wajib verifikasi institusi</span>
                </div>
                <Field icon={Hash} label="NRP / NIM" value={form.nrp} onChange={(v) => setForm({ ...form, nrp: v })} required />
                <Field icon={Building2} label="Nama Institusi" value={form.institution} onChange={(v) => setForm({ ...form, institution: v })} required placeholder="Universitas / Sekolah" />
              </>
            )}

            <label className="flex items-start gap-2 text-xs text-muted pt-2">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                className="accent-cyan mt-0.5"
              />
              Saya setuju dengan{" "}
              <Link href="/terms" className="text-cyan hover:underline">Terms</Link>
              {" "}dan{" "}
              <Link href="/privacy" className="text-cyan hover:underline">Privacy</Link>.
            </label>

            {error && (
              <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || plan === "custom"}>
              {loading ? "Membuat akun…" : (
                <>
                  Daftar sebagai {planMeta[plan].label} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <ul className="mt-5 space-y-1.5 text-[11px] text-muted">
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint" /> {plan === "student" ? "Akses fitur Student plan" : plan === "pro" ? "Akses fitur Pro plan" : "Akses Free plan, upgrade kapan saja"}</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint" /> Cancel kapan saja</li>
            <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-mint" /> Data dienkripsi end-to-end</li>
          </ul>

          <p className="text-center text-sm text-muted mt-5">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-cyan hover:underline">Login</Link>
          </p>
          <p className="text-center text-[10px] text-muted/60 mt-3">
            Prototype: data tersimpan di localStorage browser ini.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bgDeep" />}>
      <SignupForm />
    </Suspense>
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
          className="w-full pl-10 pr-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50 placeholder:text-muted/60"
        />
      </div>
    </label>
  );
}
