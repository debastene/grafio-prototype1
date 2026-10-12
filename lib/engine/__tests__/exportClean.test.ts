import { describe, it, expect } from "vitest";
import { csvCell, serializeRows } from "../exportClean";

describe("csvCell — formula injection", () => {
  it("REGRESI AUDIT: teks diawali = + - @ dinetralkan dengan prefix '", () => {
    expect(csvCell('=HYPERLINK("http://evil","klik")', ",")).toBe(`"'=HYPERLINK(""http://evil"",""klik"")"`);
    expect(csvCell("+62812", ",")).toBe("'+62812");
    expect(csvCell("-1+1", ",")).toBe("'-1+1");
    expect(csvCell("@SUM(A1)", ",")).toBe("'@SUM(A1)");
    expect(csvCell("\t=1", ",")).toBe("'\t=1");
  });

  it("angka negatif (tipe number) & teks biasa tidak diubah", () => {
    expect(csvCell(-5, ",")).toBe("-5");
    expect(csvCell("Surabaya", ",")).toBe("Surabaya");
    expect(csvCell("a,b", ",")).toBe('"a,b"');
  });

  it("serializeRows CSV memakai proteksi yang sama, JSON tidak diubah", () => {
    const rows = [{ nama: "=1+1", n: -2 }];
    expect(serializeRows(["nama", "n"], rows, "csv")).toBe("nama,n\n'=1+1,-2");
    expect(JSON.parse(serializeRows(["nama", "n"], rows, "json"))[0].nama).toBe("=1+1");
  });
});
