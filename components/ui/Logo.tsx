import Image from "next/image";

type Props = {
  className?: string;
  /** Kept for backwards compat — ring is built into the PNG, prop is ignored. */
  withRing?: boolean;
};

/**
 * Grafio logo — 12-point compass star with outer ring (PNG asset).
 *
 * Asset: /public/grafio-logo.png (versi resmi).
 * Sebelumnya logo digambar manual sebagai SVG dan hasilnya tidak matching
 * dengan brand. Sekarang pakai PNG asli supaya konsisten di seluruh app
 * (Nav, Footer, halaman auth) dan PDF report.
 *
 * Catatan: className text-* tidak akan mengubah warna karena PNG punya
 * warna fixed (silver/white di background gelap). Ukuran tetap mengikuti
 * width/height utility class (mis. `w-9 h-9`).
 */
export default function Logo({ className = "w-9 h-9" }: Props) {
  return (
    <Image
      src="/grafio-logo.png"
      alt="Grafio logo"
      width={500}
      height={500}
      priority
      className={className}
    />
  );
}
