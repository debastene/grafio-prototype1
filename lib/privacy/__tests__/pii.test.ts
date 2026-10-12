import { describe, it, expect } from "vitest";
import { isPiiColumn, maskArrayRow, maskRecord, maskText, maskTopValues } from "../pii";

describe("isPiiColumn", () => {
  it("kolom identitas/kontak/alamat dikenali per token", () => {
    for (const c of ["nama", "Nama Lengkap", "customer_name", "Email Address", "no_hp", "NoHP", "Nomor Telepon", "alamat_rumah", "NIK", "tanggal_lahir", "password", "credit_card_number"]) {
      expect(isPiiColumn(c), c).toBe(true);
    }
  });

  it("kolom metrik biasa tidak ikut disamarkan", () => {
    for (const c of ["penjualan", "harga", "kota", "tanggal", "qty", "humidity", "jumlah_pelanggan", "pass_rate", "token_count", "mobile_sessions"]) {
      expect(isPiiColumn(c), c).toBe(false);
    }
  });
});

describe("maskText", () => {
  it("email, HP Indonesia, NIK, rekening disamarkan", () => {
    expect(maskText("hubungi budi@contoh.co.id")).toBe("hubungi [email]");
    expect(maskText("WA 0812-3456-7890 ya")).toBe("WA [no-hp] ya");
    expect(maskText("+6281234567890")).toBe("[no-hp]");
    expect(maskText("NIK 3578010101900001")).toBe("NIK [nomor-id]");
    expect(maskText("rek 1234567890")).toBe("rek [nomor]");
  });

  it("angka biasa (harga, tahun, desimal) tidak disentuh", () => {
    expect(maskText("Rp 1.500.000 tahun 2024 naik 12.5%")).toBe("Rp 1.500.000 tahun 2024 naik 12.5%");
  });
});

describe("maskRecord / maskArrayRow / maskTopValues", () => {
  it("nilai kolom PII diganti seluruhnya, kolom lain dipindai pola", () => {
    expect(maskRecord({ nama: "Budi Santoso", kota: "Surabaya", catatan: "email x@y.com", omzet: 5000 })).toEqual({
      nama: "[disamarkan]",
      kota: "Surabaya",
      catatan: "email [email]",
      omzet: 5000,
    });
  });

  it("baris array mengikuti urutan header", () => {
    expect(maskArrayRow(["Ani", 12, null], ["nama", "umur", "no_hp"])).toEqual(["[disamarkan]", 12, null]);
  });

  it("top values kolom PII disamarkan", () => {
    expect(maskTopValues("nama", [{ value: "Ani", count: 3 }])).toEqual([{ value: "[disamarkan]", count: 3 }]);
    expect(maskTopValues("kota", [{ value: "Malang", count: 3 }])).toEqual([{ value: "Malang", count: 3 }]);
  });
});
