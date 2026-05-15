import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Briefcase, MapPin, Clock, Sparkles, Mail, Coffee, Globe, Heart } from "lucide-react";

export const metadata = {
  title: "Careers — Grafio",
  description: "Bangun produk data analytics yang dipakai jutaan orang Indonesia.",
};

const openRoles = [
  {
    title: "Senior Frontend Engineer (Next.js)",
    location: "Remote / Jakarta",
    type: "Full-time",
    teaser: "Bangun pengalaman dashboard yang feel instant. Stack: Next 14, TypeScript, Chart.js, Tailwind.",
  },
  {
    title: "ML Engineer — NLP Indonesia",
    location: "Remote / Jakarta",
    type: "Full-time",
    teaser: "Fine-tune model bahasa Indonesia untuk insight generation. Stack: Python, PyTorch, vLLM.",
  },
  {
    title: "Data Scientist (Customer Insights)",
    location: "Remote / Bandung",
    type: "Full-time",
    teaser: "Analisis usage pattern Grafio untuk improve product. Stack: SQL, Python, dbt.",
  },
  {
    title: "Designer (Product + Brand)",
    location: "Remote / Jakarta",
    type: "Full-time",
    teaser: "Design system, marketing asset, dashboard UX. Tools: Figma, Linear, Loom.",
  },
  {
    title: "Customer Success (Indonesian Market)",
    location: "Jakarta (onsite 3 hari)",
    type: "Full-time",
    teaser: "Onboard pelanggan Enterprise (BUMN, perbankan, startup unicorn). Bahasa Indonesia + Inggris fluent.",
  },
];

const perks = [
  { icon: Globe, title: "Remote-First", body: "Kerja dari Bali, Yogya, Medan — terserah. Kantor Jakarta opsional." },
  { icon: Clock, title: "Flexible Hours", body: "Async-first. Core hours 10:00-15:00 WIB untuk meeting." },
  { icon: Heart, title: "Health Coverage", body: "BPJS + asuransi swasta premium untuk kamu + keluarga inti." },
  { icon: Coffee, title: "Learning Budget", body: "Rp 8jt/tahun untuk kursus, buku, konferensi (termasuk overseas)." },
  { icon: Sparkles, title: "Equity for All", body: "Semua karyawan dapat stock option. Vesting 4 tahun + 1 cliff." },
  { icon: Briefcase, title: "Workation Stipend", body: "Rp 5jt/tahun untuk kerja dari luar kota / negeri. Bonding tahunan in-person." },
];

export default function Careers() {
  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="relative max-w-5xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Careers"
          title="Bangun produk untuk jutaan orang"
          description="Kami tim kecil dengan mimpi besar — bikin data analytics jadi se-mainstream Microsoft Word di Indonesia."
        />

        <Card className="mb-10 bg-gradient-to-br from-cyan/5 to-purple/5 border-cyan/20">
          <p className="text-white leading-relaxed text-sm">
            <strong className="text-cyan">Kami punya 1 prinsip rekrutmen:</strong> hire orang yang lebih
            pinter dari kami di bidangnya. Background formal kurang penting — portofolio dan cara
            berpikir lebih penting. Kalau kamu pernah bikin sesuatu yang kamu bangga, kami mau ngobrol.
          </p>
        </Card>

        <h2 className="font-syne font-bold text-white text-2xl mb-4 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-cyan" /> Open Roles
        </h2>
        <div className="space-y-3 mb-12">
          {openRoles.map((r) => (
            <Card key={r.title} hover>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="font-syne font-bold text-white mb-1">{r.title}</h3>
                  <p className="text-sm text-muted mb-2">{r.teaser}</p>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {r.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {r.type}
                    </span>
                  </div>
                </div>
                <a
                  href={`mailto:careers@grafio.app?subject=Apply: ${encodeURIComponent(r.title)}`}
                  className="px-4 py-2 rounded-md border border-cyan text-cyan hover:bg-cyan hover:text-bgDeep transition-colors text-sm font-semibold flex-shrink-0"
                >
                  Apply →
                </a>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="font-syne font-bold text-white text-2xl mb-4">Perks & Benefit</h2>
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {perks.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.title}>
                <Icon className="w-5 h-5 text-cyan mb-2" />
                <h4 className="font-syne font-semibold text-white text-sm mb-1">{p.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{p.body}</p>
              </Card>
            );
          })}
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-cyan flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white">
              <p className="font-semibold mb-1">Tidak ada role yang cocok?</p>
              <p className="text-muted">
                Kirim CV + 1 paragraf kenapa kamu mau di Grafio ke{" "}
                <a href="mailto:careers@grafio.app" className="text-cyan hover:underline">careers@grafio.app</a>. Kalau cocok, kami buatkan role baru.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
