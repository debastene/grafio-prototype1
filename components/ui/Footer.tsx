import Link from "next/link";
import Logo from "./Logo";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

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
    <footer className="relative border-t border-borderColor bg-bgSurface mt-20">
      <div className="absolute inset-0 bg-grad-hero opacity-30 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-5 gap-10 text-sm">
        <div className="md:col-span-2 flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="w-9 h-9 text-silver" />
            <span className="font-syne font-extrabold text-xl tracking-wide text-white">
              GRAFIO
            </span>
          </Link>
          <p className="text-muted max-w-sm">
            See Beyond The Numbers. AI-powered data visualization untuk analyst, scientist, dan
            creator yang ingin insight dalam hitungan detik.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <a
              href="mailto:grafio.founder@gmail.com"
              aria-label="Email"
              className="p-2 rounded-md border border-borderColor hover:border-cyan hover:text-cyan transition-colors text-muted"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="p-2 rounded-md border border-borderColor hover:border-cyan hover:text-cyan transition-colors text-muted"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="p-2 rounded-md border border-borderColor hover:border-cyan hover:text-cyan transition-colors text-muted"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="p-2 rounded-md border border-borderColor hover:border-cyan hover:text-cyan transition-colors text-muted"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-white font-semibold mb-3 font-syne">{s.title}</p>
            <ul className="space-y-2">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted hover:text-cyan transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-borderColor py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Grafio · See Beyond The Numbers
      </div>
    </footer>
  );
}
