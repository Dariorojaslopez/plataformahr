import path from "node:path";
import type { NextConfig } from "next";

/**
 * Security headers for the Next.js app.
 * API owns CORS/cookies; CSP here is for the browser document origin only.
 * `unsafe-inline` / `unsafe-eval` kept minimal for Next.js runtime needs.
 */
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
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:3001 https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
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
