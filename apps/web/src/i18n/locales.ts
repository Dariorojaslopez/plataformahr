export const APP_LOCALES = ["es", "en", "pt", "fr", "it"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "es";

export const LOCALE_STORAGE_KEY = "plataformahr.locale";

export const LOCALE_META: Record<
  AppLocale,
  { label: string; nativeLabel: string; htmlLang: string }
> = {
  es: { label: "Español", nativeLabel: "Español", htmlLang: "es" },
  en: { label: "English", nativeLabel: "English", htmlLang: "en" },
  pt: { label: "Português", nativeLabel: "Português", htmlLang: "pt-BR" },
  fr: { label: "Français", nativeLabel: "Français", htmlLang: "fr" },
  it: { label: "Italiano", nativeLabel: "Italiano", htmlLang: "it" },
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}
