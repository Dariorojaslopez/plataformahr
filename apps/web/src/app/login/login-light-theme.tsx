"use client";

import { useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

/** Login is a sales surface: always render in light for contrast and brand. */
export function LoginLightTheme({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return children;
}
