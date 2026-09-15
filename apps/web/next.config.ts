import path from "node:path";
import type { NextConfig } from "next";

/**
 * Security headers for the Next.js app.
 * API owns CORS/cookies; CSP here is for the browser document origin only.
 * `unsafe-inline` / `unsafe-eval` kept minimal for Next.js runtime needs.
 */
const isDev = process.env.NODE_ENV !== "production";
const connectSrc = isDev
  ? "connect-src 'self' http://localhost:3001 https:"
  : "connect-src 'self' https:";

/** Allow logos from NEXT_PUBLIC_API_URL when API is on another host (e.g. api.*). */
function apiOriginForImgSrc(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const apiImgOrigin = apiOriginForImgSrc();
const imgSrc = ["img-src 'self' data: blob:", apiImgOrigin]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      imgSrc,
      "font-src 'self' data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@talento/shared"],
  // Monorepo: include files outside apps/web for standalone tracing.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Hide the Next.js "N" floating DevTools badge in development.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
