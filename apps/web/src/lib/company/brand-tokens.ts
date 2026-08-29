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

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Dark surfaces need a light accent. A navy/teal brand hex used as-is
 * becomes a dark `bg-primary` with light text — or worse, if paired with
 * `bg-foreground`, white-on-white.
 */
export function liftBrandForDark(hex: string): string {
  const normalized = normalizeBrandColor(hex);
  if (!normalized) return hex;
  if (luminance(normalized) >= 0.4) return normalized;
  const [r, g, b] = hexToRgb(normalized);
  const [h, s] = rgbToHsl(r, g, b);
  return rgbToHex(...hslToRgb(h, Math.min(s, 0.55), 0.62));
}

export function contrastForeground(hex: string): string {
  return luminance(hex) > 0.179 ? "#062322" : "#F4FBFA";
}

export function brandCssVars(
  color: string | null | undefined,
  options: { dark?: boolean } = {},
): CSSProperties {
  const normalized = normalizeBrandColor(color);
  if (!normalized) return {};
  const surface = options.dark ? liftBrandForDark(normalized) : normalized;
  return {
    "--primary": surface,
    "--ring": surface,
    "--sidebar-accent": surface,
    "--primary-foreground": contrastForeground(surface),
  } as CSSProperties;
}

export function applyBrandCssProperties(
  target: HTMLElement,
  color: string | null | undefined,
  options: { dark?: boolean } = {},
): void {
  for (const key of BRAND_CSS_VARS) {
    target.style.removeProperty(key);
  }
  const vars = brandCssVars(color, options);
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
