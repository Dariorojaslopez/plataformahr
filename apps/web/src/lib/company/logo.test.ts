import { describe, expect, it } from "vitest";
import {
  COMPANY_LOGO_MAX_BYTES,
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

  it("rejects files over 1 MB", () => {
    const file = new File(
      [new Uint8Array(COMPANY_LOGO_MAX_BYTES + 1)],
      "logo.png",
      { type: "image/png" },
    );
    expect(validateCompanyLogoFile(file)).toMatch(/1 MB/);
  });
});
