import "./globals.css";
import { syne, dm } from "./fonts";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grafio — See Beyond The Numbers",
  description:
    "AI-powered data visualization. Upload CSV, Parquet, JSON, atau Excel — Grafio pilihkan chart terbaik, generate insight, dan susun dashboard interaktif dalam hitungan detik.",
  keywords: ["data visualization", "AI charts", "CSV", "Parquet", "data analyst", "data scientist", "BI tool"],
  openGraph: {
    title: "Grafio — See Beyond The Numbers",
    description: "AI data visualization untuk analyst, scientist, dan creator.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${syne.variable} ${dm.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
