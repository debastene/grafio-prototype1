import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Shield, Lock, Database, Eye, Trash2, Globe, Mail } from "lucide-react";
import { CONTACT_EMAIL, SUPPORTED_FORMATS_LABEL } from "@/lib/site";

export const metadata = {
  title: "Privacy Policy — Grafio",
  description: "Bagaimana Grafio mengumpulkan, menyimpan, dan melindungi data kamu.",
};

const sections = [
  {
    icon: Lock,
    title: "1. Data yang Kami Kumpulkan",
    body: [
      `Data file yang kamu upload (${SUPPORTED_FORMATS_LABEL}) untuk dianalisis — diproses di browser kamu.`,
      "Informasi akun: email, nama, password (di-hash oleh Supabase Auth, tidak pernah kami lihat). Plan Student/Trial: NRP, institusi, atau nomor HP yang kamu isi.",
      "Metadata teknis di log hosting (Vercel): waktu request, user agent, IP address — untuk keamanan & deteksi abuse.",
      "Tidak ada cookies pelacakan pihak ketiga. Tidak ada Google Analytics / Facebook Pixel.",
    ],
  },
  {
    icon: Database,
    title: "2. Bagaimana Data Diproses",
    body: [
      "Parsing & analisis statistik berjalan client-side di browser kamu — engine tidak meninggalkan device.",
      "Untuk fitur AI (Copilot, narasi insight, clarification) — hanya saat kamu login — yang dikirim ke OpenRouter adalah nama kolom, statistik ringkas, dan maksimal 5 baris sampel. Sebelum dikirim, data pribadi DISAMARKAN otomatis di browser: seluruh isi kolom seperti nama/email/no HP/alamat/NIK, plus pola email, nomor HP, NIK, dan nomor rekening di kolom lain.",
      "Penyamaran otomatis tidak sempurna (mis. nama orang di kolom teks bebas). Provider model gratis (Qwen, NVIDIA, Meta, Google) bisa menyimpan request untuk audit / training — jangan upload data yang sangat sensitif.",
      "Tidak ada bagian data kamu yang digunakan untuk training model Grafio.",
    ],
  },
  {
    icon: Shield,
    title: "3. Enkripsi & Keamanan",
    body: [
      "Transit: HTTPS/TLS untuk semua komunikasi.",
      "Storage: saat kamu klik Save Project, ringkasan analisis + maksimal 100 baris pertama data hasil cleaning disimpan di Supabase (Postgres, terenkripsi at-rest oleh infrastruktur Supabase).",
      "Password: di-hash oleh Supabase Auth (bcrypt), tidak pernah disimpan plaintext.",
      "Akses data dibatasi Row Level Security + hak per kolom — tiap user hanya bisa baca/tulis miliknya sendiri, dan tidak bisa mengubah plan/credits sendiri.",
    ],
  },
  {
    icon: Trash2,
    title: "4. Retensi & Penghapusan",
    body: [
      "File yang diupload diproses di memory browser. Hasil analisis (maks 200 baris) disimpan sementara di sessionStorage tab ini supaya tidak hilang saat reload, dan terhapus saat tab ditutup.",
      "Project yang kamu save manual tersimpan sampai kamu hapus sendiri — bisa dihapus kapan saja dari halaman Projects.",
      `Right to be forgotten: kirim email ke ${CONTACT_EMAIL} — kami hapus akun & data dalam 7 hari kerja.`,
    ],
  },
  {
    icon: Eye,
    title: "5. Hak Kamu (mengacu UU PDP No. 27/2022 & prinsip GDPR)",
    body: [
      "Akses: minta export semua data yang kami punya tentangmu.",
      "Koreksi: minta kami perbaiki data yang tidak akurat.",
      "Hapus: minta hapus permanen.",
      "Portabilitas: terima data dalam format machine-readable (JSON).",
      "Batalkan persetujuan: fitur AI hanya aktif saat login. Tanpa login, engine statistik tetap jalan penuh di browser tanpa mengirim data ke provider AI.",
    ],
  },
  {
    icon: Globe,
    title: "6. Transfer Lintas Negara",
    body: [
      "Hosting: Vercel (edge global) + database Supabase (region Singapore).",
      "Provider AI model: data routing global (US, EU, Asia) tergantung model. Lihat openrouter.ai/privacy untuk detail.",
      "Kami tidak menjual atau menyewakan data kamu ke pihak ketiga manapun.",
    ],
  },
];

export default function Privacy() {
  return (
    <main className="min-h-screen bg-bgDeep relative overflow-x-hidden">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 bg-grad-hero opacity-50 pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-6 py-24">
        <div className="reveal">
        <SectionHeader
          eyebrow="Legal"
          title="Privacy Policy"
          description="Berlaku efektif 12 Oktober 2026 · Versi 2.2 · Kami percaya privasi adalah hak, bukan fitur."
        />
        </div>

        <Card className="mb-6 reveal" hover>
          <p className="text-sm text-white leading-relaxed">
            <strong className="text-cyan">Singkat:</strong> Data kamu adalah datamu. Kami tidak pakai
            datamu untuk training model Grafio, dan kamu bisa hapus kapan saja. Engine statistik jalan di
            browser-mu, tidak menyentuh server kami. Untuk fitur AI generatif (saat login), nama kolom,
            statistik ringkas, dan beberapa baris sampel — dengan data pribadi disamarkan otomatis —
            dikirim ke provider model via OpenRouter. Provider free-tier bisa menyimpan request tersebut,
            jadi hindari upload data yang sangat sensitif.
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
                Email <a href={`mailto:${CONTACT_EMAIL}?subject=PRIVACY`} className="text-cyan hover:underline">{CONTACT_EMAIL}</a> — kami respons dalam 48 jam kerja.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
