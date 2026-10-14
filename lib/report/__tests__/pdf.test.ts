import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeFile } from "@/lib/engine";
import { generateReport } from "../pdf";

/** 3 segmen pelanggan: hemat (sering, kecil), premium (jarang, besar), baru. */
function customerCsv(): string {
  const seg = [
    [150_000, 12, 4.1, 2],
    [900_000, 3, 4.6, 6],
    [80_000, 1, 3.2, 1],
  ];
  const kota = ["Surabaya", "Malang", "Sidoarjo", "Gresik"];
  const lines = ["id_pelanggan,kota,belanja_bulanan,frekuensi,rating,lama_member_tahun"];
  let id = 1;
  seg.forEach((c, g) => {
    for (let i = 0; i < 40; i++) {
      const j = ((i * 37 + g * 11) % 13) / 13 - 0.5;
      lines.push(
        [
          `C${String(id++).padStart(4, "0")}`,
          kota[(i + g) % kota.length],
          Math.round(c[0] * (1 + j * 0.2)),
          Math.max(1, Math.round(c[1] + j * 2)),
          (c[2] + j * 0.3).toFixed(1),
          Math.max(0, Math.round(c[3] + j * 2)),
        ].join(","),
      );
    }
  });
  return lines.join("\n");
}

async function pdfText(blob: Blob): Promise<string> {
  return Buffer.from(await blob.arrayBuffer()).toString("latin1");
}

describe("generateReport", () => {
  it("memuat bagian Analisis Multivariat (PCA + klaster) bila tersedia", async () => {
    const r = await analyzeFile(new File([customerCsv()], "pelanggan.csv"), "");
    expect(r.domain.id).toBe("sales");
    expect(r.multivariate?.clusters?.k).toBe(3);

    const blob = await generateReport(r);
    const raw = await pdfText(blob);
    if (process.env.GRAFIO_PDF_OUT) writeFileSync(process.env.GRAFIO_PDF_OUT, Buffer.from(await blob.arrayBuffer()));

    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain("Analisis Multivariat");
    expect(raw).toContain("UJI KELAYAKAN PCA");
    expect(raw).toContain("KLASTER K-MEANS");
    expect(raw).toMatch(/k = 3, silhouette 0\.\d\d/);
  });

  it("proyek lama tanpa hasil multivariat tetap bisa diekspor", async () => {
    const r = await analyzeFile(new File([customerCsv()], "pelanggan.csv"), "");
    const raw = await pdfText(await generateReport({ ...r, multivariate: undefined }));
    expect(raw).not.toContain("Analisis Multivariat");
    expect(raw).toContain("tidak dihitung");
  });
});
