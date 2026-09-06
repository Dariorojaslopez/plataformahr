"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import {
  BRAND_PALETTE_FAMILIES,
  COMPANY_BRAND_PALETTES,
  type BrandPalette,
  type BrandPaletteFamily,
  findBrandPaletteByPrimary,
} from "@/lib/company/brand-palettes";
import { normalizeBrandColor } from "@/lib/company/brand-tokens";
import { cn } from "@/lib/utils";

type BrandPalettePickerProps = {
  value: string;
  onChange: (primary: string, palette: BrandPalette | null) => void;
  className?: string;
  compact?: boolean;
};

export function BrandPalettePicker({
  value,
  onChange,
  className,
  compact = false,
}: BrandPalettePickerProps) {
  const normalized = normalizeBrandColor(value);
  const selected = findBrandPaletteByPrimary(normalized);
  const initialFamily =
    selected?.family ?? BRAND_PALETTE_FAMILIES[0]?.id ?? "teal";
  const [family, setFamily] = useState<BrandPaletteFamily>(initialFamily);

  const palettes = COMPANY_BRAND_PALETTES.filter((p) => p.family === family);

  return (
    <div className={cn("space-y-3", className)}>
      {!compact ? (
        <div>
          <p className="text-sm font-medium">Paleta institucional</p>
          <p className="text-xs text-muted-foreground">
            Elige un estilo de marca. Serio, moderno y con carácter — el color
            principal tiñe botones, acentos y la barra lateral.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {BRAND_PALETTE_FAMILIES.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setFamily(group.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
              family === group.id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {palettes.map((palette) => {
          const active =
            selected?.id === palette.id ||
            normalized === palette.primary.toUpperCase();
          return (
            <PaletteCard
              key={palette.id}
              palette={palette}
              active={active}
              compact={compact}
              onSelect={() => onChange(palette.primary, palette)}
            />
          );
        })}
      </div>

      {normalized && !selected ? (
        <p className="text-xs text-muted-foreground">
          Color personalizado activo:{" "}
          <span className="font-mono">{normalized}</span>
        </p>
      ) : null}
    </div>
  );
}

function PaletteCard({
  palette,
  active,
  compact,
  onSelect,
}: {
  palette: BrandPalette;
  active: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative overflow-hidden rounded-lg border text-left transition",
        "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground/40 ring-2 ring-ring"
          : "border-border bg-card",
        compact ? "p-2" : "p-3",
      )}
    >
      <div
        className={cn(
          "mb-2 flex overflow-hidden rounded-md",
          compact ? "h-8" : "h-10",
        )}
        aria-hidden
      >
        <span className="w-[28%]" style={{ background: palette.dark }} />
        <span className="w-[44%]" style={{ background: palette.primary }} />
        <span className="w-[28%]" style={{ background: palette.light }} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "font-medium leading-tight",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {palette.name}
          </p>
          {!compact ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
              {palette.vibe}
            </p>
          ) : null}
        </div>
        {active ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </div>
    </button>
  );
}
