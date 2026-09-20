"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageMenuItems } from "@/i18n/language-menu";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  align = "end",
  className,
}: {
  align?: "start" | "end" | "center";
  className?: string;
}) {
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          aria-label={t("Idioma")}
        >
          <Languages className="h-4 w-4" aria-hidden />
          <span>{t("Idioma")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <LanguageMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
