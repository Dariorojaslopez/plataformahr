import { describe, expect, it } from "vitest";
import {
  PLATFORM_BRAND_PRIMARY,
  SEMANTIC_CSS_VARS,
  applyBrandCssProperties,
  brandCssVars,
  companyInitials,
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
});
