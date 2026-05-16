"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import { Mail, RefreshCw, Check, AlertTriangle, Inbox, ArrowRight, Clock } from "lucide-react";
import { resendConfirmation } from "@/lib/auth/storage";

function VerifyForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const callbackError = params.get("error");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const [cooldown, setCooldown] = useState(0);

  // Countdown after resend to prevent spam
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    setError(null);
    setResent(false);
    const res = await resendConfirmation(email);
    setResending(false);
    if (!res.ok) {
      setError(res.error ?? "Gagal kirim ulang");
      return;
    }
    setResent(true);
    setCooldown(60); // 60-second cooldown
  };

  // Mask middle of email for privacy display
  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c)
    : "";

  return (
    <main className="min-h-screen bg-bgDeep flex items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-40" />

      <div className="relative w-full max-w-lg">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 group">
          <Logo className="w-10 h-10 text-silver group-hover:text-cyan transition-colors" />
          <span className="font-syne font-extrabold text-2xl tracking-wide text-white">
            GRAFIO
          </span>
        </Link>

        <div className="glass rounded-3xl p-8 md:p-10 shadow-soft relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan/15 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple/15 blur-3xl rounded-full pointer-events-none" />

          <div className="relative">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan/20 to-purple/20 border border-cyan/30 flex items-center justify-center relative">
              <Mail className="w-9 h-9 text-cyan" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-mint flex items-center justify-center animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-bgDeep" />
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-syne font-bold text-white text-center mb-3">
              Cek inbox email kamu
            </h1>
            <p className="text-muted text-center mb-6 leading-relaxed">
              Kami sudah kirim link konfirmasi ke{" "}
              {email ? (
                <span className="text-white font-mono">{maskedEmail}</span>
              ) : (
                "email kamu"
              )}
              . Klik link di email untuk aktivasi akun.
            </p>

            {/* Step-by-step */}
            <div className="bg-bgSurface/40 rounded-xl border border-borderColor p-5 mb-6 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan mb-2 flex items-center gap-1.5">
                <Inbox className="w-3 h-3" /> Langkah berikutnya
              </p>
              <Step num={1} text="Buka aplikasi email kamu (Gmail, Outlook, dll)" />
              <Step num={2} text='Cari email dari "Supabase Auth" — subject "Confirm your signup"' />
              <Step num={3} text='Klik tombol "Confirm your email" di dalamnya' />
              <Step num={4} text="Kamu akan otomatis di-redirect ke dashboard Grafio" />
            </div>

            {/* Not in inbox? */}
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 mb-6 text-xs leading-relaxed">
              <p className="text-warning font-semibold mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Email belum masuk?
              </p>
              <ul className="text-muted space-y-1 ml-5 list-disc">
                <li>Cek folder <strong className="text-white">Spam</strong> atau <strong className="text-white">Promotions</strong></li>
                <li>Tunggu 1-2 menit (kadang ada delay dari mail provider)</li>
                <li>Pastikan email kamu tidak typo</li>
              </ul>
            </div>

            {/* Resend */}
            <div className="space-y-3">
              <button
                onClick={onResend}
                disabled={!email || resending || cooldown > 0}
                className="w-full py-3 rounded-md border border-cyan/30 bg-cyan/5 text-cyan hover:bg-cyan/15 transition-all text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Mengirim ulang…
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <Clock className="w-4 h-4" /> Tunggu {cooldown} detik untuk kirim ulang
                  </>
                ) : resent ? (
                  <>
                    <Check className="w-4 h-4 text-mint" /> Email konfirmasi sudah dikirim ulang
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> Kirim ulang email konfirmasi
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Bottom links */}
            <div className="mt-6 pt-6 border-t border-borderColor text-center space-y-2">
              <p className="text-xs text-muted">
                Salah email?{" "}
                <Link href="/signup" className="text-cyan hover:underline">
                  Daftar ulang
                </Link>
              </p>
              <p className="text-xs text-muted">
                Sudah konfirmasi?{" "}
                <Link href="/login" className="text-cyan hover:underline inline-flex items-center gap-1">
                  Login sekarang <ArrowRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3 text-xs text-white">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan/15 border border-cyan/30 text-cyan font-mono font-bold flex items-center justify-center text-[10px]">
        {num}
      </span>
      <span className="leading-relaxed pt-0.5">{text}</span>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bgDeep" />}>
      <VerifyForm />
    </Suspense>
  );
}
