import { describe, it, expect } from "vitest";
import { detectNumberFormat, parseWithFormat, applyNumberFormat } from "../numberFormat";

describe("parseWithFormat", () => {
  it("format ID: titik = ribuan, koma = desimal", () => {
    expect(parseWithFormat("1.234,56", "id")).toBe(1234.56);
    expect(parseWithFormat("1.234.567", "id")).toBe(1234567);
    expect(parseWithFormat("12,5", "id")).toBe(12.5);
  });

  it("format EN: koma = ribuan, titik = desimal", () => {
    expect(parseWithFormat("1,234.56", "en")).toBe(1234.56);
    expect(parseWithFormat("1,234,567", "en")).toBe(1234567);
    expect(parseWithFormat("12.5", "en")).toBe(12.5);
  });

  it("string sama, hasil beda per format (inti masalahnya)", () => {
    expect(parseWithFormat("1.234", "id")).toBe(1234);
    expect(parseWithFormat("1.234", "en")).toBe(1.234);
  });

  it("strip prefix Rp & simbol currency", () => {
    expect(parseWithFormat("Rp 1.500.000", "id")).toBe(1500000);
    expect(parseWithFormat("$1,500", "en")).toBe(1500);
  });

  it("persen dibagi 100", () => {
    expect(parseWithFormat("12,5%", "id")).toBe(0.125);
    expect(parseWithFormat("12.5%", "en")).toBe(0.125);
  });

  it("angka negatif", () => {
    expect(parseWithFormat("-1.234,5", "id")).toBe(-1234.5);
  });

  it("non-angka → null", () => {
    expect(parseWithFormat("abc", "id")).toBeNull();
    expect(parseWithFormat("", "en")).toBeNull();
    expect(parseWithFormat("12abc", "en")).toBeNull();
  });
});

describe("detectNumberFormat", () => {
  it("sample dominan ID → format id", () => {
    const d = detectNumberFormat(["1.234,56", "9.876,54", "2.345.678,90"]);
    expect(d.format).toBe("id");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("sample dominan EN → format en", () => {
    const d = detectNumberFormat(["1,234.56", "9,876.54", "2,345,678.90"]);
    expect(d.format).toBe("en");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("tanpa sample numerik → default id, ambiguous, confidence rendah", () => {
    const d = detectNumberFormat(["hello", null, undefined, 42]);
    expect(d.format).toBe("id");
    expect(d.ambiguous).toBe(true);
    expect(d.confidence).toBeLessThan(0.5);
  });

  it("skor imbang → default id + ambiguous", () => {
    // "12,5" (ID decimal) vs "12.5" (EN decimal) → 1 poin masing-masing
    const d = detectNumberFormat(["12,5", "12.5"]);
    expect(d.format).toBe("id");
    expect(d.ambiguous).toBe(true);
  });
});

describe("applyNumberFormat", () => {
  it("konversi string angka sesuai format, biarkan string lain", () => {
    const rows = [{ harga: "1.500,25", nama: "Produk A", tanggal: "2024-01-15" }];
    const out = applyNumberFormat(rows, ["harga", "nama", "tanggal"], "id");
    expect(out[0].harga).toBe(1500.25);
    expect(out[0].nama).toBe("Produk A"); // ada huruf → skip
    expect(out[0].tanggal).toBe("2024-01-15"); // ISO date → skip
  });

  it("tidak memutasi rows input", () => {
    const rows = [{ v: "1.000" as string | number }];
    applyNumberFormat(rows, ["v"], "id");
    expect(rows[0].v).toBe("1.000");
  });

  it("nilai yang sudah number / null dibiarkan", () => {
    const rows = [{ a: 42, b: null }];
    const out = applyNumberFormat(rows, ["a", "b"], "en");
    expect(out[0].a).toBe(42);
    expect(out[0].b).toBeNull();
  });
});
