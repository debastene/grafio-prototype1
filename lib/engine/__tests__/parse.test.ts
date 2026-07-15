import { describe, it, expect } from "vitest";
import { parseText, coerceValue, inferColType } from "../parse";

describe("parseText — CSV", () => {
  it("parse CSV dasar: headers + rows + cell kosong jadi null", () => {
    const t = parseText("name,age,city\nAndi,25,Surabaya\nBudi,,Jakarta\n", "csv");
    expect(t.headers).toEqual(["name", "age", "city"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toEqual({ name: "Andi", age: "25", city: "Surabaya" });
    expect(t.rows[1].age).toBeNull();
    expect(t.format).toBe("csv");
  });

  it("quoted field berisi koma & escaped quote", () => {
    const t = parseText('id,desc\n1,"Halo, dunia"\n2,"Dia bilang ""hai"""\n', "csv");
    expect(t.rows[0].desc).toBe("Halo, dunia");
    expect(t.rows[1].desc).toBe('Dia bilang "hai"');
  });

  it("header multi-line dalam quote TIDAK memotong kolom (regression world-data bug)", () => {
    const t = parseText('Country,"Density\n(P/Km2)",Abbreviation\nID,145,Indonesia\n', "csv");
    expect(t.headers).toEqual(["Country", "Density (P/Km2)", "Abbreviation"]);
    expect(t.rows[0]["Density (P/Km2)"]).toBe("145");
    expect(t.rows[0].Abbreviation).toBe("Indonesia");
  });

  it("auto-detect delimiter titik-koma", () => {
    const t = parseText("a;b;c\n1;2;3\n4;5;6\n", "csv");
    expect(t.delimiter).toBe(";");
    expect(t.rows[0]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("baris kosong di-skip", () => {
    const t = parseText("a,b\n1,2\n\n\n3,4\n", "csv");
    expect(t.rows).toHaveLength(2);
  });

  it("header kosong dinamai col_N", () => {
    const t = parseText("a,,c\n1,2,3\n", "csv");
    expect(t.headers).toEqual(["a", "col_2", "c"]);
  });

  it("CRLF line endings", () => {
    const t = parseText("a,b\r\n1,2\r\n3,4\r\n", "csv");
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1]).toEqual({ a: "3", b: "4" });
  });
});

describe("parseText — TSV / JSON / JSONL", () => {
  it("TSV eksplisit", () => {
    const t = parseText("a\tb\n1\t2\n", "tsv");
    expect(t.format).toBe("tsv");
    expect(t.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("JSON array of objects — union semua key jadi headers", () => {
    const t = parseText('[{"a":1,"b":"x"},{"a":2,"c":true}]', "json");
    expect(t.headers.sort()).toEqual(["a", "b", "c"]);
    expect(t.rows[0].c).toBeNull(); // key absen → null
    expect(t.rows[1].c).toBe(true);
  });

  it("JSONL — satu object per baris", () => {
    const t = parseText('{"a":1}\n{"a":2}\n', "jsonl");
    expect(t.format).toBe("jsonl");
    expect(t.rows).toHaveLength(2);
  });

  it("nested object di JSON di-stringify", () => {
    const t = parseText('[{"a":{"x":1}}]', "json");
    expect(t.rows[0].a).toBe('{"x":1}');
  });
});

describe("coerceValue", () => {
  it("integer & float", () => {
    expect(coerceValue("42")).toEqual({ value: 42, type: "integer" });
    expect(coerceValue("3.14")).toEqual({ value: 3.14, type: "number" });
    expect(coerceValue("-7")).toEqual({ value: -7, type: "integer" });
  });

  it("percent → pecahan", () => {
    expect(coerceValue("12%")).toEqual({ value: 0.12, type: "percent" });
    expect(coerceValue("12.5%")).toEqual({ value: 0.125, type: "percent" });
  });

  it("currency dengan simbol", () => {
    expect(coerceValue("$1,234")).toEqual({ value: 1234, type: "currency" });
    expect(coerceValue("€99.5")).toEqual({ value: 99.5, type: "currency" });
  });

  it("angka dengan pemisah ribuan EN", () => {
    expect(coerceValue("1,234,567")).toEqual({ value: 1234567, type: "number" });
  });

  it("boolean", () => {
    expect(coerceValue("true")).toEqual({ value: true, type: "boolean" });
    expect(coerceValue("No")).toEqual({ value: false, type: "boolean" });
  });

  it("null-ish tokens → null", () => {
    expect(coerceValue("").type).toBeNull();
    expect(coerceValue("null").value).toBeNull();
    expect(coerceValue("NA").value).toBeNull();
    expect(coerceValue("-").value).toBeNull();
    expect(coerceValue(null).value).toBeNull();
  });

  it("tanggal ISO → timestamp number, type date", () => {
    const r = coerceValue("2024-01-15");
    expect(r.type).toBe("date");
    expect(r.value).toBe(Date.parse("2024-01-15"));
  });

  it("teks biasa tetap text", () => {
    expect(coerceValue("hello world")).toEqual({ value: "hello world", type: "text" });
  });

  it("input yang sudah number dipertahankan", () => {
    expect(coerceValue(5)).toEqual({ value: 5, type: "integer" });
    expect(coerceValue(5.5)).toEqual({ value: 5.5, type: "number" });
  });
});

describe("inferColType", () => {
  it("kolom integer murni → integer", () => {
    expect(inferColType(["1", "2", "3", null])).toBe("integer");
  });

  it("string berulang kardinalitas rendah → categorical", () => {
    const vals = Array.from({ length: 100 }, (_, i) => ["merah", "hijau", "biru"][i % 3]);
    expect(inferColType(vals)).toBe("categorical");
  });

  it("string unik banyak → text", () => {
    const vals = Array.from({ length: 200 }, (_, i) => `deskripsi unik nomor ${i}`);
    expect(inferColType(vals)).toBe("text");
  });

  it("semua null → text (fallback aman)", () => {
    expect(inferColType([null, null])).toBe("text");
  });
});
