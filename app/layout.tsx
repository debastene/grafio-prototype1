import "./globals.css";
import { syne, dm } from "./fonts";
import { Metadata, Viewport } from "next";
import SmoothScrollProvider from "@/components/ui/motion/SmoothScrollProvider";

// metadataBase memastikan OG image URL resolve absolute saat di-share.
// Default ke NEXT_PUBLIC_SITE_URL kalau ada (Vercel auto-injection),
// fallback ke production domain. Di local dev, image akan pakai relative path.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://grafio-jade.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Grafio — See Beyond The Numbers",
    template: "%s · Grafio",
  },
  description:
    "AI analytics workspace untuk analyst, scientist & founder Indonesia. Upload CSV, Excel, JSON, atau Parquet — Grafio pilihkan chart terbaik, menulis insight bersudut pandang, & susun dashboard interaktif dalam hitungan detik.",
  keywords: [
    "data visualization", "AI analytics", "dashboard Indonesia",
    "CSV", "Parquet", "Excel", "data analyst", "data scientist",
    "BI tool", "insight AI", "Grafio",
  ],
  authors: [{ name: "Grafio" }],
  creator: "Grafio",
  publisher: "Grafio",
  applicationName: "Grafio",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "Grafio",
    title: "Grafio — See Beyond The Numbers",
    description:
      "AI analytics workspace untuk analyst, scientist & founder Indonesia. Insight bersudut pandang dalam hitungan detik.",
    images: [
      {
        url: "/grafio-logo.png",
        width: 500,
        height: 500,
        alt: "Grafio — AI Analytics Workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grafio — See Beyond The Numbers",
    description:
      "AI analytics workspace untuk analyst, scientist & founder Indonesia.",
    images: ["/grafio-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#05081a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${syne.variable} ${dm.variable}`}>
      <body className="antialiased">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
