import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Shield, Lock, Database, Eye, Trash2, Globe, Mail } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Grafio",
  description: "Bagaimana Grafio mengumpulkan, menyimpan, dan melindungi data kamu.",
};

const sections = [
  {
    icon: Lock,
    title: "1. Data yang Kami Kumpulkan",
    body: [
      "Data file yang kamu upload (CSV / Excel / JSON / dll) untuk dianalisis.",
      "Informasi akun: email, nama, password ter-hash (bcrypt cost 12).",
      "Metadata teknis: timestamp upload, user agent, IP address (untuk rate-limit & deteksi abuse).",
      "Tidak ada cookies pelacakan pihak ketiga. Tidak ada Google Analytics / Facebook Pixel.",
    ],
  },
  {
    icon: Database,
    title: "2. Bagaimana Data Diproses",
    body: [
      "Parsing & analisis statistik berjalan client-side di browser kamu — engine tidak meninggalkan device.",
      "Untuk fitur AI (Copilot, narasi insight, clarification), schema + sample 5 baris dikirim ke OpenRouter (provider model gratis). Raw data full tidak dikirim.",
      "Provider model gratis (Qwen, NVIDIA, Meta, Google) mungkin menyimpan request untuk audit / training mereka — gunakan paket berbayar untuk privasi penuh.",
      "Tidak ada bagian data kamu yang digunakan untuk training model Grafio.",
    ],
  },
  {
    icon: Shield,
    title: "3. Enkripsi & Keamanan",
    body: [
      "Transit: TLS 1.3 (HTTPS) untuk semua komunikasi.",
      "Storage: AES-256 untuk data at-rest (kalau kamu pakai fitur Save Workspace).",
      "Password: bcrypt cost 12, tidak pernah disimpan plaintext.",
      "Auditable: source code engine open untuk inspeksi.",
    ],
  },
  {
    icon: Trash2,
    title: "4. Retensi & Penghapusan",
    body: [
      "File yang diupload disimpan di memory browser selama sesi aktif saja. Reload = data hilang.",
      "Workspace yang kamu save manual disimpan max 90 hari — bisa dihapus kapan saja dari Settings.",
      "Akun yang tidak aktif > 12 bulan akan di-anonymize otomatis.",
      "Right to be forgotten: kirim email ke privacy@grafio.app — kami hapus dalam 7 hari kerja.",
    ],
  },
  {
    icon: Eye,
    title: "5. Hak Kamu (GDPR + UU PDP)",
    body: [
      "Akses: minta export semua data yang kami punya tentangmu.",
      "Koreksi: minta kami perbaiki data yang tidak akurat.",
      "Hapus: minta hapus permanen.",
      "Portabilitas: terima data dalam format machine-readable (JSON).",
      "Batalkan persetujuan: opt-out dari processing AI fitur kapan saja.",
    ],
  },
  {
    icon: Globe,
    title: "6. Transfer Lintas Negara",
    body: [
      "Server utama: Singapore (AWS ap-southeast-1).",
      "Provider AI model: data routing global (US, EU, Asia) tergantung model. Lihat openrouter.ai/privacy untuk detail.",
      "Kami tidak menjual atau menyewakan data kamu ke pihak ketiga manapun.",
    ],
  },
];

export default function Privacy() {
  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Legal"
          title="Privacy Policy"
          description="Berlaku efektif 1 Januari 2026 · Versi 2.1 · Kami percaya privasi adalah hak, bukan fitur."
        />

        <Card className="mb-6">
          <p className="text-sm text-white leading-relaxed">
            <strong className="text-cyan">Singkat:</strong> Data kamu adalah datamu. Kami enkripsi end-to-end,
            tidak pakai untuk training model, dan kamu bisa hapus kapan saja. Engine statistik jalan di
            browser-mu, tidak menyentuh server kami. Untuk fitur AI generatif, hanya schema + sample
            5 baris yang dikirim ke provider model OpenRouter.
          </p>
        </Card>

        <div className="space-y-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan/15 border border-cyan/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-cyan" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-syne font-bold text-white mb-2">{s.title}</h3>
                    <ul className="space-y-1.5 text-sm text-muted">
                      {s.body.map((line, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-cyan flex-shrink-0">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-cyan flex-shrink-0 mt-0.5" />
            <div className="text-sm text-white">
              <p className="font-semibold mb-1">Pertanyaan tentang privacy?</p>
              <p className="text-muted">
                Email <a href="mailto:privacy@grafio.app" className="text-cyan hover:underline">privacy@grafio.app</a> — kami respons dalam 48 jam kerja.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
