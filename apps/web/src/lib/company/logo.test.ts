import { describe, expect, it } from "vitest";
import {
  COMPANY_LOGO_MAX_BYTES,
  scaleLogoDimensions,
  validateCompanyLogoFile,
} from "@/lib/company/logo";

describe("validateCompanyLogoFile", () => {
  it("accepts a small png", () => {
    const file = new File([new Uint8Array(32)], "logo.png", {
      type: "image/png",
    });
    expect(validateCompanyLogoFile(file)).toBeNull();
  });

  it("rejects unsupported types", () => {
    const file = new File(["x"], "logo.svg", { type: "image/svg+xml" });
    expect(validateCompanyLogoFile(file)).toMatch(/PNG, JPEG o WebP/);
  });

  it("rejects files over 10 MB", () => {
    const file = new File(
      [new Uint8Array(COMPANY_LOGO_MAX_BYTES + 1)],
      "logo.png",
      { type: "image/png" },
    );
    expect(validateCompanyLogoFile(file)).toMatch(/10 MB/);
  });
});

describe("scaleLogoDimensions", () => {
  it("keeps already valid sizes", () => {
    expect(scaleLogoDimensions(1024, 412)).toEqual({
      width: 1024,
      height: 412,
    });
  });

  it("scales down the longest side to 2048", () => {
    expect(scaleLogoDimensions(4096, 1648)).toEqual({
      width: 2048,
      height: 824,
    });
  });
});
