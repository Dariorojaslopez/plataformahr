"use client";

import { Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { APP_LOCALES, LOCALE_META } from "@/i18n/locales";
import { useLocale } from "@/i18n/locale-provider";

export function LanguageMenuItems() {
  const { locale, setLocale, t } = useLocale();

  return (
    <>
      <DropdownMenuLabel>{t("Idioma")}</DropdownMenuLabel>
      {APP_LOCALES.map((code) => (
        <DropdownMenuItem
          key={code}
          onSelect={(event) => {
            event.preventDefault();
            setLocale(code);
          }}
        >
          <span className="flex w-full items-center justify-between gap-3">
            <span>{LOCALE_META[code].nativeLabel}</span>
            {locale === code ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : null}
          </span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function LanguageMenuSection() {
  return (
    <>
      <DropdownMenuSeparator />
      <LanguageMenuItems />
    </>
  );
}
