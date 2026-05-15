"use client";
import { useState } from "react";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import { Mail, MessageSquare, Building2, Send, Check } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "", topic: "Sales" });
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;

    const subject = `[Grafio - ${form.topic}] from ${form.name}`;
    const bodyLines = [
      `Halo Tim Grafio,`,
      ``,
      `Nama       : ${form.name}`,
      `Email      : ${form.email}`,
      `Perusahaan : ${form.company || "-"}`,
      `Topik      : ${form.topic}`,
      ``,
      `Pesan:`,
      form.message,
      ``,
      `--`,
      `Dikirim via grafio.app/contact`,
    ];
    const body = bodyLines.join("\n");

    // Build mailto URL
    const mailto = `mailto:grafio.founder@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Open user's email client
    window.location.href = mailto;

    setSent(true);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <main className="min-h-screen bg-bgDeep relative">
      <Nav />
      <div className="absolute inset-0 bg-grad-hero pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Contact"
          title="Mari Bicara tentang Datamu"
          description="Tim kami siap membantu — sales, support, partnership, atau sekedar diskusi."
        />

        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card glass className="!p-8">
              <form onSubmit={submit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-muted">Nama</span>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Email</span>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1 w-full px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-muted">Perusahaan / Institusi</span>
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Topik</span>
                  <select
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50"
                  >
                    <option>Sales</option>
                    <option>Support</option>
                    <option>Partnership</option>
                    <option>Press / Media</option>
                    <option>Lainnya</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Pesan</span>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-bgSurface border border-borderColor rounded-md text-sm text-white focus:outline-none focus:border-cyan/50 resize-none"
                  />
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button type="submit" className="w-full md:w-auto">
                    {sent ? <><Check className="w-4 h-4" /> Email client dibuka!</> : <><Send className="w-4 h-4" /> Kirim Pesan</>}
                  </Button>
                  <p className="text-[11px] text-muted">
                    Tombol ini membuka email client default Anda dengan pesan yang sudah disiapkan.
                  </p>
                </div>
              </form>
            </Card>
          </div>

          {/* Side info */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-cyan" />
                <p className="font-syne font-semibold text-white">Email langsung</p>
              </div>
              <a href="mailto:grafio.founder@gmail.com" className="text-sm text-cyan hover:underline">
                grafio.founder@gmail.com
              </a>
              <p className="text-xs text-muted mt-2">Respon dalam 1×24 jam.</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-cyan" />
                <p className="font-syne font-semibold text-white" id="sales">Enterprise</p>
              </div>
              <p className="text-sm text-muted">
                Diskusi custom plan, on-prem, SSO, dan dedicated CSM.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-cyan" />
                <p className="font-syne font-semibold text-white">Komunitas</p>
              </div>
              <p className="text-sm text-muted">
                Join Discord & forum untuk tanya-jawab dengan tim & user lain.
              </p>
            </Card>
          </div>
        </div>

        {/* About / Privacy / Terms anchors */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-6xl mx-auto">
          <Card id="about">
            <h3 className="font-syne font-bold text-white mb-2">About</h3>
            <p className="text-sm text-muted leading-relaxed">
              Grafio dibangun untuk membantu siapa saja — analyst, scientist, founder, mahasiswa —
              memahami data tanpa harus jadi expert. See Beyond The Numbers.
            </p>
          </Card>
          <Card id="privacy">
            <h3 className="font-syne font-bold text-white mb-2">Privacy</h3>
            <p className="text-sm text-muted leading-relaxed">
              Data kamu dienkripsi AES-256, tidak disimpan setelah analisis selesai, dan tidak
              pernah digunakan untuk training model AI. GDPR &amp; UU PDP compliant.
            </p>
          </Card>
          <Card id="terms">
            <h3 className="font-syne font-bold text-white mb-2">Terms</h3>
            <p className="text-sm text-muted leading-relaxed">
              Penggunaan Grafio tunduk pada Terms of Service kami. Cancel kapan saja, refund
              prorata untuk paket tahunan dalam 30 hari pertama.
            </p>
          </Card>
        </div>
      </div>
      <Footer />
    </main>
  );
}
