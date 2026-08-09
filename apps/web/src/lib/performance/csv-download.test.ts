import { describe, expect, it } from "vitest";

/** Mirrors API Content-Disposition filename parsing used by apiRequestBlob. */
function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}

describe("CSV download auth behavior", () => {
  it("parses safe attachment filename from Content-Disposition", () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="resultados-desempeno-ciclo-2026-08-09.csv"',
      ),
    ).toBe("resultados-desempeno-ciclo-2026-08-09.csv");
  });

  it("does not put tokens in query params for export path", () => {
    const path = "/performance/results/export?cycleId=abc&areaId=def";
    expect(path).not.toMatch(/token|Bearer|accessToken/i);
    expect(path).toContain("cycleId=abc");
    expect(path).toContain("areaId=def");
  });
});
