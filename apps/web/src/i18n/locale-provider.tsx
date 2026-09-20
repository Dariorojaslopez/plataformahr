"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import {
  getLocaleSnapshot,
  getServerLocaleSnapshot,
  persistLocale,
  setAppLocale,
  subscribeLocale,
} from "@/i18n/locale-store";
import { translate } from "@/i18n/translate";

type TranslateFn = (text: string, vars?: Record<string, string>) => string;

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: TranslateFn;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (text, vars) => translate(DEFAULT_LOCALE, text, vars),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setAppLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (text, vars) => translate(locale, text, vars),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}
