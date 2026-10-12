import { describe, it, expect } from "vitest";
import { safeNextPath } from "../safeRedirect";

describe("safeNextPath", () => {
  it("path internal diterima", () => {
    expect(safeNextPath("/projects")).toBe("/projects");
    expect(safeNextPath("/quiz/abc?x=1")).toBe("/quiz/abc?x=1");
    expect(safeNextPath("%2Fprojects%2F123")).toBe("/projects/123");
  });

  it("REGRESI AUDIT: URL eksternal / protocol-relative ditolak", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "%2F%2Fevil.com",
      "javascript:alert(1)",
      "evil.com",
      "/%0a//evil.com",
    ]) {
      expect(safeNextPath(bad), bad).toBe("/dashboard");
    }
  });

  it("kosong → fallback", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("", "/")).toBe("/");
  });
});
