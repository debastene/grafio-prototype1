import { describe, expect, it } from "vitest";
import { detectDomain } from "../domain";
import type { ColProfile } from "../profile";

// detectDomain hanya membaca nama kolom.
const cols = (...names: string[]) => names.map((name) => ({ name }) as ColProfile);

describe("detectDomain", () => {
  it("data pelanggan dengan kolom rating → penjualan, bukan survei", () => {
    const d = detectDomain(cols("id_pelanggan", "kota", "belanja_bulanan", "frekuensi", "rating", "lama_member_tahun"));
    expect(d.id).toBe("sales");
  });

  it("kuesioner tetap terdeteksi sebagai survei", () => {
    expect(detectDomain(cols("responden", "usia", "kepuasan_layanan", "q1", "q2", "rating")).id).toBe("survey");
    expect(detectDomain(cols("respondent_id", "question", "answer", "score")).id).toBe("survey");
  });

  it("satu kata ambigu saja tidak cukup → Dataset Umum", () => {
    expect(detectDomain(cols("rating", "x", "y")).id).toBe("generic");
    expect(detectDomain(cols("nilai", "kode")).id).toBe("generic");
  });

  it("substring pendek tidak salah tangkap ('age' di 'percentage')", () => {
    expect(detectDomain(cols("percentage", "average_value", "coverage")).id).toBe("generic");
  });

  it("OHLCV saham → keuangan walau tiap kolom hint lemah", () => {
    expect(detectDomain(cols("Date", "Open", "High", "Low", "Close", "Volume")).id).toBe("finance");
  });

  it("data negara (camelCase ikut ditokenisasi)", () => {
    expect(detectDomain(cols("Country", "Region", "GDPPerCapita", "Population", "LifeExpectancy")).id).toBe("country");
  });

  it("nilai transaksi tidak dianggap data pendidikan", () => {
    expect(detectDomain(cols("tanggal", "nilai_transaksi", "produk", "jumlah")).id).toBe("sales");
  });

  it("data mahasiswa → pendidikan", () => {
    expect(detectDomain(cols("nim", "nama", "matkul", "nilai", "ipk")).id).toBe("education");
  });
});
