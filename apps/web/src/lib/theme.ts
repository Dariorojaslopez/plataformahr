const LIGHT_MARKETING_PATHS = ["/login", "/forgot-password"] as const;

/** Login pages stay light visually; next-themes does not persist forcedTheme. */
export function forcedThemeForPath(
  pathname: string | null | undefined,
): "light" | undefined {
  if (!pathname) return undefined;
  return LIGHT_MARKETING_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
    ? "light"
    : undefined;
}
