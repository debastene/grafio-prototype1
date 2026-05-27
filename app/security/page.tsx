import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Shield, Lock, Key, Server, AlertTriangle, FileCheck, Bell, Mail } from "lucide-react";

export const metadata = {
  title: "Security — Grafio",
  description: "Standar keamanan, infrastruktur, dan compliance Grafio.",
};

const pillars = [
  {
    icon: Lock,
    title: "Encryption Everywhere",
    items: [
      "TLS 1.3 untuk semua trafik (HTTPS-only, HSTS preload).",
      "AES-256-GCM untuk data at-rest.",
      "Key rotation otomatis tiap 90 hari via AWS KMS.",
    ],
  },
  {
    icon: Key,
    title: "Authentication",
    items: [
      "Password: bcrypt cost 12, breach check via HaveIBeenPwned.",
      "2FA opsional via TOTP (Google Authenticator, Authy).",
      "Session: HTTP-only secure cookies, expire 30 hari, rotation tiap login.",
      "SSO (Google, Microsoft, SAML) tersedia di plan Enterprise.",
    ],
  },
  {
    icon: Server,
    title: "Infrastruktur",
    items: [
      "Hosted di AWS Singapore (ap-southeast-1) — region utama untuk Asia Tenggara.",
      "Edge caching via Cloudflare (DDoS protection layer 3/4/7).",
      "Database: PostgreSQL 16 dengan automated daily backup + point-in-time recovery 7 hari.",
      "Secret management: AWS Secrets Manager + rotation policy.",
    ],
  },
  {
    icon: FileCheck,
    title: "Compliance",
    items: [
      "GDPR-ready (DPA tersedia untuk pelanggan Enterprise).",
      "UU PDP Indonesia (UU No. 27 Tahun 2022) — fully compliant.",
      "SOC 2 Type II audit dalam proses (target Q3 2026).",
      "ISO 27001 readiness assessment — gap closure 80% per April 2026.",
    ],
  },
];

const responsibleDisclosure = [
  {
    icon: AlertTriangle,
    title: "Apa yang in-scope",
    body: "Domain grafio.app, *.grafio.app, dan repo terbuka kami. Out-of-scope: serangan DDoS, social engineering ke karyawan, fisik akses kantor.",
  },
  {
    icon: Bell,
    title: "Cara melaporkan",
    body: "Email security@grafio.app dengan POC + langkah reproduce. Encrypt pakai PGP key kami (key ID 0xGRAFIO2026). Acknowledge dalam 24 jam kerja.",
  },
  {
    icon: FileCheck,
    title: "Bug bounty",
    body: "Critical: Rp 5-15jt. High: Rp 1-5jt. Medium: Rp 250-1jt. Hall of Fame untuk semua valid report.",
  },
];

export default function Security() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 bg-grad-hero opacity-50 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="reveal">
        <SectionHeader
          eyebrow="Security"
          title="Keamanan adalah Fondasi"
          description="Bagaimana kami melindungi data, akun, dan infrastruktur kamu — dengan rincian teknis, bukan janji marketing."
        />
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-12">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.title} hover className="reveal">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-cyan" />
                  </div>
                  <h3 className="font-syne font-bold text-white pt-1.5">{p.title}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-muted">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-cyan flex-shrink-0">•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-cyan" />
            <h2 className="font-syne font-bold text-white text-2xl">Responsible Disclosure</h2>
          </div>
          <p className="text-sm text-muted mb-6">
            Menemukan vulnerability? Kami menghargai security researcher yang ngasih tahu kami dulu sebelum publish.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {responsibleDisclosure.map((d) => {
              const Icon = d.icon;
              return (
                <Card key={d.title}>
                  <Icon className="w-5 h-5 text-cyan mb-2" />
                  <h4 className="font-syne font-semibold text-white text-sm mb-1.5">{d.title}</h4>
                  <p className="text-xs text-muted leading-relaxed">{d.body}</p>
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-cyan flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white">
              <p className="font-semibold mb-1">Security Contact</p>
              <p className="text-muted">
                Email <a href="mailto:security@grafio.app" className="text-cyan hover:underline">security@grafio.app</a> · PGP fingerprint tersedia di /well-known/security.txt
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
