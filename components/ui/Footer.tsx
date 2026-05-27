import Link from "next/link";
import Logo from "./Logo";
import { Github, Twitter, Linkedin, Mail, ArrowUpRight } from "lucide-react";

const sections = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-borderColor bg-bgSurface mt-24 overflow-hidden">
      <div className="absolute inset-0 bg-grad-hero opacity-30 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[320px] bg-cyan/8 blur-3xl rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-10 grid md:grid-cols-5 gap-12 text-sm">
        <div className="md:col-span-2 flex flex-col gap-5">
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <Logo className="w-10 h-10 group-hover:scale-105 transition-transform duration-400 ease-glide" />
            <span className="font-syne font-extrabold text-2xl tracking-wide text-white group-hover:text-gradient transition-all duration-400 ease-glide">
              GRAFIO
            </span>
          </Link>
          <p className="text-muted max-w-sm leading-relaxed">
            See Beyond The Numbers. AI-powered data visualization untuk analyst, scientist, dan
            creator yang ingin insight dalam hitungan detik.
          </p>
          <div className="flex items-center gap-2 mt-1">
            {[
              { href: "mailto:grafio.founder@gmail.com", label: "Email", Icon: Mail, external: false },
              { href: "https://github.com", label: "GitHub", Icon: Github, external: true },
              { href: "https://twitter.com", label: "Twitter", Icon: Twitter, external: true },
              { href: "https://linkedin.com", label: "LinkedIn", Icon: Linkedin, external: true },
            ].map(({ href, label, Icon, external }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="p-2.5 rounded-lg border border-borderColor bg-bgSurface/60 backdrop-blur-sm hover:border-cyan/50 hover:bg-cyan/8 hover:text-cyan transition-all duration-300 ease-glide text-muted"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-white font-semibold mb-4 font-syne text-sm tracking-wide">
              {s.title}
            </p>
            <ul className="space-y-2.5">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted hover:text-cyan transition-colors duration-250 ease-glide inline-flex items-center gap-1 group"
                  >
                    <span className="link-underline">{l.label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-250 ease-glide" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative border-t border-borderColor py-7 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
        <span>© {new Date().getFullYear()} Grafio · See Beyond The Numbers</span>
        <span className="font-mono opacity-70">v2.0 · made with care in Indonesia</span>
      </div>
    </footer>
  );
}
