import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { TRANSLATIONS } from "@/i18n/messages";

export function applyVars(
  text: string,
  vars?: Record<string, string>,
): string {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    text,
  );
}

export function translate(
  locale: AppLocale,
  text: string,
  vars?: Record<string, string>,
): string {
  if (!text) return text;
  if (locale === DEFAULT_LOCALE) return applyVars(text, vars);
  const required = text.endsWith(" *");
  const source = required ? text.slice(0, -2) : text;
  const translated = TRANSLATIONS[locale][source] ?? source;
  return applyVars(required ? `${translated} *` : translated, vars);
}
