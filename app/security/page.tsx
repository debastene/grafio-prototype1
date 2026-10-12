import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Shield, Lock, Key, Server, AlertTriangle, FileCheck, Bell, Mail } from "lucide-react";
import { CONTACT_EMAIL, SITE_HOST } from "@/lib/site";

export const metadata = {
  title: "Security — Grafio",
  description: "Standar keamanan, infrastruktur, dan compliance Grafio.",
};

const pillars = [
  {
    icon: Lock,
    title: "Enkripsi",
    items: [
      "HTTPS/TLS untuk semua trafik (dikelola Vercel).",
      "Data at-rest dienkripsi oleh infrastruktur Supabase (Postgres).",
      "File analisis TIDAK diupload ke server — engine statistik jalan di browser kamu. Sampel untuk AI disamarkan dulu (nama, email, no HP, NIK, alamat).",
    ],
  },
  {
    icon: Key,
    title: "Authentication",
    items: [
      "Password di-hash bcrypt oleh Supabase Auth — tidak pernah plaintext.",
      "Verifikasi email saat signup.",
      "Session di cookie Supabase (SameSite=Lax, hanya lewat HTTPS karena HSTS). Cookie ini terbaca JavaScript (bukan HttpOnly), jadi kami memasang Content-Security-Policy untuk menekan risiko XSS.",
      "Row Level Security + hak per kolom: tiap user hanya bisa akses data miliknya, dan tidak bisa mengubah plan/credits sendiri.",
    ],
  },
  {
    icon: Server,
    title: "Infrastruktur",
    items: [
      "Hosting: Vercel (edge network global + DDoS protection bawaan).",
      "Database: Supabase Postgres, region Singapore — terdekat untuk Indonesia.",
      "Endpoint AI wajib login, ukuran & bentuk payload divalidasi, lalu di-rate-limit per user.",
      "Secrets (API key) hanya di environment variables server — tidak pernah di client.",
    ],
  },
  {
    icon: FileCheck,
    title: "Compliance",
    items: [
      "Kami startup tahap awal — belum tersertifikasi SOC 2 / ISO 27001, dan kami tidak akan mengklaim sebaliknya.",
      "Desain mengikuti prinsip UU PDP (UU No. 27/2022) & GDPR: minimalisasi data, hak akses & hapus.",
      "Fitur AI memakai provider model pihak ketiga (OpenRouter) — lihat halaman Privacy untuk detail aliran data.",
      "Sertifikasi formal masuk roadmap seiring pertumbuhan pelanggan enterprise.",
    ],
  },
];

const responsibleDisclosure = [
  {
    icon: AlertTriangle,
    title: "Apa yang in-scope",
    body: `Aplikasi di ${SITE_HOST} beserta API-nya. Out-of-scope: serangan DDoS, social engineering, dan pengujian yang merusak/menghapus data pengguna lain.`,
  },
  {
    icon: Bell,
    title: "Cara melaporkan",
    body: `Email ${CONTACT_EMAIL} dengan subjek "SECURITY", POC + langkah reproduce. Kami usahakan acknowledge dalam 2×24 jam kerja.`,
  },
  {
    icon: FileCheck,
    title: "Apresiasi",
    body: "Belum ada bug bounty berbayar (kami masih tahap awal). Valid report dapat ucapan terima kasih publik di Hall of Fame + swag Grafio kalau tersedia.",
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
                Email <a href={`mailto:${CONTACT_EMAIL}?subject=SECURITY`} className="text-cyan hover:underline">{CONTACT_EMAIL}</a>
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
