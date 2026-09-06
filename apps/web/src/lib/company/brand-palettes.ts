import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";

export type BrandPaletteFamily =
  | "teal"
  | "blue"
  | "green"
  | "red"
  | "neutral"
  | "warm"
  | "violet";

export type BrandPalette = {
  id: string;
  name: string;
  vibe: string;
  family: BrandPaletteFamily;
  /** Color institucional que se guarda en `brandPrimaryColor`. */
  primary: string;
  /** Tono claro para la franja de preview (no se persiste). */
  light: string;
  /** Tono profundo para la franja de preview (no se persiste). */
  dark: string;
};

export const BRAND_PALETTE_FAMILIES: {
  id: BrandPaletteFamily;
  label: string;
}[] = [
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Azules" },
  { id: "green", label: "Verdes" },
  { id: "red", label: "Rojos" },
  { id: "warm", label: "Cálidos" },
  { id: "neutral", label: "Neutros" },
  { id: "violet", label: "Oscuros" },
];

/**
 * Paletas institucionales: modernas, agresivas y serias.
 * Solo `primary` se persiste; light/dark son para el picker.
 */
export const COMPANY_BRAND_PALETTES: BrandPalette[] = [
  {
    id: "talentgrowthos",
    name: "Talentgrowthos",
    vibe: "Teal institucional — confianza y plataforma",
    family: "teal",
    primary: PLATFORM_BRAND_PRIMARY,
    light: "#5ECDC8",
    dark: "#0A3D3C",
  },
  {
    id: "pacific-depth",
    name: "Pacífico profundo",
    vibe: "Teal oscuro, limpio y ejecutivo",
    family: "teal",
    primary: "#0D4F4C",
    light: "#4DB6B0",
    dark: "#062E2C",
  },
  {
    id: "atlantic-navy",
    name: "Navy Atlántico",
    vibe: "Azul noche corporativo, peso y autoridad",
    family: "blue",
    primary: "#0B1F3A",
    light: "#3B82F6",
    dark: "#061228",
  },
  {
    id: "cobalt-strike",
    name: "Cobalto Strike",
    vibe: "Azul eléctrico serio — producto y tech",
    family: "blue",
    primary: "#1D4ED8",
    light: "#60A5FA",
    dark: "#1E3A8A",
  },
  {
    id: "ice-command",
    name: "Hielo Comando",
    vibe: "Cian frío, preciso y moderno",
    family: "blue",
    primary: "#0E7490",
    light: "#67E8F9",
    dark: "#164E63",
  },
  {
    id: "steel-horizon",
    name: "Horizonte Acero",
    vibe: "Azul pizarra — sobrio con punch",
    family: "blue",
    primary: "#334155",
    light: "#94A3B8",
    dark: "#0F172A",
  },
  {
    id: "forest-command",
    name: "Bosque Comando",
    vibe: "Verde militar elegante, estabilidad",
    family: "green",
    primary: "#14532D",
    light: "#4ADE80",
    dark: "#052E16",
  },
  {
    id: "emerald-ops",
    name: "Esmeralda Ops",
    vibe: "Verde vivo institucional, crecimiento",
    family: "green",
    primary: "#047857",
    light: "#34D399",
    dark: "#064E3B",
  },
  {
    id: "olive-strategy",
    name: "Oliva Estrategia",
    vibe: "Verde oliva táctico, distinto y serio",
    family: "green",
    primary: "#3F6212",
    light: "#A3E635",
    dark: "#1A2E05",
  },
  {
    id: "crimson-board",
    name: "Carmesí Board",
    vibe: "Rojo ejecutivo — decisión y energía",
    family: "red",
    primary: "#B91C1C",
    light: "#F87171",
    dark: "#7F1D1D",
  },
  {
    id: "wine-authority",
    name: "Vino Autoridad",
    vibe: "Burdeos premium, marca de peso",
    family: "red",
    primary: "#9F1239",
    light: "#FB7185",
    dark: "#4C0519",
  },
  {
    id: "rosewood",
    name: "Palo Rosa",
    vibe: "Rojo oscuro contemporáneo",
    family: "red",
    primary: "#881337",
    light: "#F43F5E",
    dark: "#4C0519",
  },
  {
    id: "amber-authority",
    name: "Ámbar Autoridad",
    vibe: "Ámbar intenso — liderazgo y foco",
    family: "warm",
    primary: "#B45309",
    light: "#FBBF24",
    dark: "#78350F",
  },
  {
    id: "copper-edge",
    name: "Cobre Edge",
    vibe: "Cobre industrial, agresivo pero refinado",
    family: "warm",
    primary: "#9A3412",
    light: "#FB923C",
    dark: "#7C2D12",
  },
  {
    id: "graphite-core",
    name: "Grafito Core",
    vibe: "Gris carbón — minimalismo poderoso",
    family: "neutral",
    primary: "#1F2937",
    light: "#9CA3AF",
    dark: "#111827",
  },
  {
    id: "slate-force",
    name: "Pizarra Force",
    vibe: "Gris azulado, UI moderna y seca",
    family: "neutral",
    primary: "#475569",
    light: "#CBD5E1",
    dark: "#1E293B",
  },
  {
    id: "charcoal-line",
    name: "Carbón Line",
    vibe: "Casi negro con acento frío",
    family: "neutral",
    primary: "#18181B",
    light: "#A1A1AA",
    dark: "#09090B",
  },
  {
    id: "indigo-vault",
    name: "Índigo Vault",
    vibe: "Índigo profundo — premium y tech",
    family: "violet",
    primary: "#312E81",
    light: "#818CF8",
    dark: "#1E1B4B",
  },
  {
    id: "midnight-board",
    name: "Medianoche Board",
    vibe: "Violeta noche, boardroom moderno",
    family: "violet",
    primary: "#4C1D95",
    light: "#A78BFA",
    dark: "#2E1065",
  },
];

export function findBrandPaletteByPrimary(
  primary: string | null | undefined,
): BrandPalette | null {
  if (!primary) return null;
  const upper = primary.trim().toUpperCase();
  return (
    COMPANY_BRAND_PALETTES.find((p) => p.primary.toUpperCase() === upper) ??
    null
  );
}
