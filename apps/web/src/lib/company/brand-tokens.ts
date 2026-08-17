import type { CSSProperties } from "react";

/** Official Plataforma HR accent. Tenant branding never applies on global login. */
export const PLATFORM_BRAND_PRIMARY = "#0F5C5A";

export const BRAND_CSS_VARS = [
  "--primary",
  "--ring",
  "--sidebar-accent",
  "--primary-foreground",
] as const;

export const SEMANTIC_CSS_VARS = [
  "--destructive",
  "--destructive-foreground",
  "--warning",
  "--warning-foreground",
  "--success",
  "--success-foreground",
] as const;

const HEX = /^#[0-9A-F]{6}$/;

export function normalizeBrandColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!HEX.test(trimmed)) return null;
  return trimmed;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const rgb = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

export function contrastForeground(hex: string): string {
  return luminance(hex) > 0.45 ? "#062322" : "#F4FBFA";
}

export function brandCssVars(
  color: string | null | undefined,
): CSSProperties {
  const normalized = normalizeBrandColor(color);
  if (!normalized) return {};
  return {
    "--primary": normalized,
    "--ring": normalized,
    "--sidebar-accent": normalized,
    "--primary-foreground": contrastForeground(normalized),
  } as CSSProperties;
}

export function applyBrandCssProperties(
  target: HTMLElement,
  color: string | null | undefined,
): void {
  for (const key of BRAND_CSS_VARS) {
    target.style.removeProperty(key);
  }
  const vars = brandCssVars(color);
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "string") target.style.setProperty(key, value);
  }
}

export function companyInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "HR";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "HR";
}
