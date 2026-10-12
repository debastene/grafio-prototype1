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
  // Versi 256px (18 KB). File asli 4000px / 2,1 MB hanya dipakai PDF report —
  // image optimizer dimatikan di next.config.mjs, jadi ukuran asset penting.
  return (
    <Image
      src="/grafio-logo-256.webp"
      alt="Grafio logo"
      width={256}
      height={256}
      priority
      className={className}
    />
  );
}
