import { describe, it, expect } from "vitest";
import { coerceValue, detectDateOrder, inferColType, monthIndex, parseDateString } from "../parse";
import { parseWithFormat } from "../numberFormat";

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

describe("parseDateString", () => {
  it("REGRESI AUDIT: 05/01/2024 format Indonesia = 5 Januari, bukan 1 Mei", () => {
    expect(parseDateString("05/01/2024", "dmy")).toBe(utc(2024, 1, 5));
    expect(parseDateString("05-01-2024", "dmy")).toBe(utc(2024, 1, 5));
    expect(parseDateString("05.01.2024", "dmy")).toBe(utc(2024, 1, 5));
  });

  it("format AS tetap bisa dengan urutan mdy", () => {
    expect(parseDateString("12/25/2024", "mdy")).toBe(utc(2024, 12, 25));
  });

  it("tanggal mustahil ditolak (Date.parse dulu menggulirkan 30 Feb → 1 Mar)", () => {
    expect(parseDateString("2024-02-30")).toBeNull();
    expect(parseDateString("31/04/2024", "dmy")).toBeNull();
    expect(parseDateString("2023-02-29")).toBeNull();
    expect(parseDateString("2024-02-29")).toBe(utc(2024, 2, 29)); // kabisat
  });

  it("tahun 2 digit", () => {
    expect(parseDateString("05/01/24", "dmy")).toBe(utc(2024, 1, 5));
    expect(parseDateString("05/01/98", "dmy")).toBe(utc(1998, 1, 5));
  });

  it("nama bulan Indonesia & Inggris", () => {
    expect(parseDateString("15 Januari 2024")).toBe(utc(2024, 1, 15));
    expect(parseDateString("17 Agustus 1945")).toBe(utc(1945, 8, 17));
    expect(parseDateString("Mei 2024")).toBe(utc(2024, 5, 1));
    expect(parseDateString("Mar 15, 2024")).toBe(utc(2024, 3, 15));
    expect(parseDateString("2024-07")).toBe(utc(2024, 7, 1));
  });

  it("ISO tanpa zona dianggap UTC (konsisten antar baris)", () => {
    expect(parseDateString("2024-01-15T10:30:00")).toBe(Date.UTC(2024, 0, 15, 10, 30, 0));
    expect(parseDateString("2024-01-15T10:30:00+07:00")).toBe(Date.UTC(2024, 0, 15, 3, 30, 0));
  });

  it("bukan tanggal → null", () => {
    expect(parseDateString("hello")).toBeNull();
    expect(parseDateString("Januari")).toBeNull();
  });
});

describe("detectDateOrder", () => {
  it("komponen pertama > 12 → dmy; kedua > 12 → mdy; ambigu → dmy (konvensi ID)", () => {
    expect(detectDateOrder(["05/01/2024", "28/01/2024"])).toBe("dmy");
    expect(detectDateOrder(["01/05/2024", "01/28/2024"])).toBe("mdy");
    expect(detectDateOrder(["01/02/2024", "03/04/2024"])).toBe("dmy");
  });
});

describe("inferColType dengan tanggal DD/MM", () => {
  it("REGRESI AUDIT: kolom tanggal 01..28/01/2024 terbaca sebagai date (dulu jadi text)", () => {
    const vals = Array.from({ length: 28 }, (_, i) => `${String(i + 1).padStart(2, "0")}/01/2024`);
    expect(inferColType(vals)).toBe("date");
  });
});

describe("coerceValue", () => {
  it("ISO date-only tetap sama dengan perilaku lama", () => {
    expect(coerceValue("2024-01-15")).toEqual({ value: Date.parse("2024-01-15"), type: "date" });
  });

  it("REGRESI UJI-BROWSER: no HP '0812…' & NIK 16 digit tetap teks (nol depan/presisi tidak hilang)", () => {
    expect(coerceValue("081234567000")).toEqual({ value: "081234567000", type: "text" });
    expect(coerceValue("3578010101900001")).toEqual({ value: "3578010101900001", type: "text" });
    expect(coerceValue("0")).toEqual({ value: 0, type: "integer" });
    expect(coerceValue("120")).toEqual({ value: 120, type: "integer" });
  });
});

describe("monthIndex", () => {
  it("nama bulan ID/EN penuh & singkat", () => {
    expect(monthIndex("Januari")).toBe(1);
    expect(monthIndex("agt")).toBe(8);
    expect(monthIndex("Okt.")).toBe(10);
    expect(monthIndex("December")).toBe(12);
    expect(monthIndex("Senin")).toBeNull();
  });
});

describe("parseWithFormat — validasi pemisah ribuan", () => {
  it("tanggal bertitik tidak lagi dibaca sebagai angka", () => {
    expect(parseWithFormat("05.01.2024", "id")).toBeNull();
  });

  it("'1.5' bukan ribuan valid di format ID (dulu jadi 15)", () => {
    expect(parseWithFormat("1.5", "id")).toBeNull();
    expect(parseWithFormat("1.500", "id")).toBe(1500);
  });

  it("koma ribuan EN harus grup 3 digit", () => {
    expect(parseWithFormat("1,5", "en")).toBeNull();
    expect(parseWithFormat("1,500", "en")).toBe(1500);
  });
});
