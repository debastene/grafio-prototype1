import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { ScrollText, UserCheck, CreditCard, Ban, Scale, RefreshCw, Mail } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Grafio",
  description: "Syarat dan ketentuan penggunaan Grafio.",
};

const sections = [
  {
    icon: UserCheck,
    title: "1. Akun & Kelayakan",
    body: [
      "Kamu harus minimal 13 tahun untuk menggunakan Grafio.",
      "Satu akun untuk satu orang. Jangan share password.",
      "Kamu bertanggung jawab penuh atas aktivitas yang dilakukan via akunmu.",
      "Berikan informasi akurat saat registrasi. Akun dengan data palsu akan dinonaktifkan.",
    ],
  },
  {
    icon: ScrollText,
    title: "2. Penggunaan yang Diizinkan",
    body: [
      "Analisis dataset milik sendiri atau yang kamu punya izin untuk olah.",
      "Generate report untuk keperluan internal, publikasi, atau presentasi.",
      "Share workspace ke kolega via link (kontrol akses ada di Settings).",
      "Embed chart ke artikel/laporan dengan attribution opsional ke grafio.app.",
    ],
  },
  {
    icon: Ban,
    title: "3. Yang Dilarang",
    body: [
      "Upload data yang melanggar hak orang lain (data pribadi tanpa consent, dokumen rahasia, konten ilegal).",
      "Scraping / crawling Grafio secara otomatis tanpa izin tertulis.",
      "Reverse engineering, dekompilasi, atau modifikasi service kami.",
      "Menggunakan Grafio untuk aktivitas penipuan, fraud, money laundering, atau pelanggaran hukum lain.",
      "Membuat akun duplikat untuk menghindari rate limit atau ban.",
    ],
  },
  {
    icon: CreditCard,
    title: "4. Free vs Paid Plan",
    body: [
      "Free plan: rate limit 50 AI request/hari, max 50MB/file, watermark di PDF export.",
      "Pro plan: unlimited AI request (fair use), max 500MB/file, no watermark, priority support.",
      "Enterprise: custom limit, SSO, audit log, SLA 99.9%, dedicated support.",
      "Pembayaran: Stripe (kartu) atau bank transfer (invoice ≥ Rp 5 juta).",
      "Refund prorata untuk paket tahunan dalam 30 hari pertama, tidak ada pertanyaan.",
    ],
  },
  {
    icon: Scale,
    title: "5. Kepemilikan Konten",
    body: [
      "Data yang kamu upload: tetap 100% milikmu. Grafio hanya numpang olah, tidak punya hak ownership.",
      "Insight, narasi, dan visualisasi yang dihasilkan: milikmu, bebas dipakai untuk komersial.",
      "Brand 'Grafio', logo compass, dan UI design: milik Grafio. Jangan dipakai tanpa izin tertulis.",
    ],
  },
  {
    icon: RefreshCw,
    title: "6. Perubahan & Penghentian",
    body: [
      "Kami bisa update Terms ini sewaktu-waktu. Perubahan material akan diumumkan via email 30 hari sebelum berlaku.",
      "Kamu bisa cancel akun kapan saja dari Settings → Delete Account.",
      "Kami bisa suspend / terminate akun yang melanggar Terms, biasanya setelah peringatan tertulis (kecuali kasus berat: langsung suspend).",
      "Kalau service Grafio dihentikan, kami beri notice 60 hari + tool export data.",
    ],
  },
  {
    icon: Scale,
    title: "7. Limitasi Tanggung Jawab",
    body: [
      "Grafio disediakan 'AS IS'. Kami berusaha keras tapi tidak menjamin 100% uptime atau hasil analisis bebas error.",
      "AI insight bersifat probabilistik — verifikasi keputusan kritikal dengan analis manusia.",
      "Maximum liability: total biaya yang kamu bayar ke Grafio dalam 12 bulan terakhir.",
      "Force majeure (bencana, perang, perubahan regulasi pemerintah) di luar tanggung jawab kami.",
    ],
  },
  {
    icon: Scale,
    title: "8. Hukum yang Berlaku",
    body: [
      "Terms ini diatur oleh hukum Republik Indonesia.",
      "Sengketa diselesaikan via musyawarah dulu, lalu BANI Jakarta kalau gagal.",
      "Konsumen non-bisnis tetap dilindungi UU Perlindungan Konsumen + UU PDP.",
    ],
  },
];

export default function Terms() {
  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="relative max-w-4xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Legal"
          title="Terms of Service"
          description="Berlaku efektif 1 Januari 2026 · Versi 2.1 · Dengan menggunakan Grafio, kamu setuju dengan syarat di bawah."
        />

        <Card className="mb-6">
          <p className="text-sm text-white leading-relaxed">
            <strong className="text-cyan">Versi pendek:</strong> Pakai Grafio untuk hal baik, jangan
            upload data yang bukan haknya, bayar kalau pakai paket pro, dan kamu bisa cancel kapan saja.
            Selebihnya baca detail di bawah.
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
              <p className="font-semibold mb-1">Pertanyaan legal?</p>
              <p className="text-muted">
                Email <a href="mailto:legal@grafio.app" className="text-cyan hover:underline">legal@grafio.app</a> — tim legal kami akan respons dalam 5 hari kerja.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <Footer />
    </main>
  );
}
