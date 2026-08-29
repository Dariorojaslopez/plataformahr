import { describe, expect, it } from "vitest";
import {
  PLATFORM_BRAND_PRIMARY,
  SEMANTIC_CSS_VARS,
  applyBrandCssProperties,
  brandCssVars,
  companyInitials,
  contrastForeground,
  liftBrandForDark,
  normalizeBrandColor,
} from "@/lib/company/brand-tokens";

describe("brand tokens", () => {
  it("normalizes #RRGGBB and rejects CSS", () => {
    expect(normalizeBrandColor("#0f5c5a")).toBe("#0F5C5A");
    expect(normalizeBrandColor("url(#x)")).toBeNull();
    expect(normalizeBrandColor("#fff")).toBeNull();
  });

  it("applies brand tokens without overwriting semantic colors", () => {
    const el = document.createElement("div");
    el.style.setProperty("--destructive", "#b42318");
    el.style.setProperty("--warning", "#b54708");
    el.style.setProperty("--success", "#067647");
    applyBrandCssProperties(el, "#112233");
    expect(el.style.getPropertyValue("--primary")).toBe("#112233");
    expect(el.style.getPropertyValue("--ring")).toBe("#112233");
    expect(el.style.getPropertyValue("--sidebar-accent")).toBe("#112233");
    expect(el.style.getPropertyValue("--destructive")).toBe("#b42318");
    expect(el.style.getPropertyValue("--warning")).toBe("#b54708");
    expect(el.style.getPropertyValue("--success")).toBe("#067647");
    for (const key of SEMANTIC_CSS_VARS) {
      expect(Object.keys(brandCssVars("#112233"))).not.toContain(key);
    }
  });

  it("clears brand overrides when color is restored", () => {
    const el = document.createElement("div");
    applyBrandCssProperties(el, "#112233");
    applyBrandCssProperties(el, null);
    expect(el.style.getPropertyValue("--primary")).toBe("");
  });

  it("switches company colors without leaking the previous value", () => {
    const el = document.createElement("div");
    applyBrandCssProperties(el, "#111111");
    applyBrandCssProperties(el, "#ABCDEF");
    expect(el.style.getPropertyValue("--primary")).toBe("#ABCDEF");
    expect(el.style.getPropertyValue("--primary")).not.toBe("#111111");
  });

  it("keeps platform default distinct for global login", () => {
    expect(PLATFORM_BRAND_PRIMARY).toBe("#0F5C5A");
    expect(companyInitials("Acme Corp")).toBe("AC");
  });

  it("picks dark text on mid-light brand colors", () => {
    expect(contrastForeground("#A78BFA")).toBe("#062322");
    expect(contrastForeground("#0F5C5A")).toBe("#F4FBFA");
  });

  it("lifts a dark brand for dark surfaces and keeps a light one", () => {
    const lifted = liftBrandForDark("#0F5C5A");
    expect(lifted).not.toBe("#0F5C5A");
    expect(contrastForeground(lifted)).toBe("#062322");
    expect(liftBrandForDark("#5ECDC8")).toBe("#5ECDC8");
  });

  it("applies the lifted surface only when dark is requested", () => {
    const light = brandCssVars("#0F5C5A") as Record<string, string>;
    const dark = brandCssVars("#0F5C5A", { dark: true }) as Record<
      string,
      string
    >;
    expect(light["--primary"]).toBe("#0F5C5A");
    expect(light["--primary-foreground"]).toBe("#F4FBFA");
    expect(dark["--primary"]).not.toBe("#0F5C5A");
    expect(dark["--primary-foreground"]).toBe("#062322");
  });
});
