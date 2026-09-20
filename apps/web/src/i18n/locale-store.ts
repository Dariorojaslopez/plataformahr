import {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALE_STORAGE_KEY,
  isAppLocale,
  type AppLocale,
} from "@/i18n/locales";
import { translate } from "@/i18n/translate";

const listeners = new Set<() => void>();

let currentLocale: AppLocale = DEFAULT_LOCALE;
let hydrated = false;

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isAppLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function getLocaleSnapshot(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (!hydrated) {
    currentLocale = readStoredLocale();
    hydrated = true;
  }
  return currentLocale;
}

export function getServerLocaleSnapshot(): AppLocale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function persistLocale(locale: AppLocale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  document.documentElement.lang = LOCALE_META[locale].htmlLang;
}

export function setAppLocale(locale: AppLocale) {
  currentLocale = locale;
  hydrated = true;
  persistLocale(locale);
  listeners.forEach((listener) => listener());
}

export function translateUi(
  text: string,
  vars?: Record<string, string>,
): string {
  return translate(getLocaleSnapshot(), text, vars);
}

export function resetLocaleStore() {
  currentLocale = DEFAULT_LOCALE;
  hydrated = false;
  listeners.forEach((listener) => listener());
}
