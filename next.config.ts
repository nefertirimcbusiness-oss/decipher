import type { NextConfig } from "next";

// The API lives on its own origin (see src/lib/api.ts), so the browser makes
// cross-origin requests to it and renders evidence files from it. Derive that
// origin here, at build time, from the same variable the client reads — a
// hard-coded origin would silently break every API call the day the app moves.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://eb044699c4cc4dada8cc7727a5002ea2-dev.cto.site/api";
const API_ORIGIN = new URL(API_BASE_URL).origin;

// What this policy deliberately allows, and why (each one was checked against
// the app rather than copied from a template):
//
//   script-src 'unsafe-inline'  Next.js inlines its own bootstrap/hydration
//     scripts into the HTML. Without either a nonce (which needs middleware and
//     forces every page to render dynamically) or 'unsafe-inline', React never
//     hydrates and the app is a white screen. Remote scripts are still limited
//     to our own origin, so this keeps the part of the policy that matters for
//     injected third-party scripts.
//   style-src 'unsafe-inline'   Tailwind/Next inject inline <style> blocks and
//     components set inline style attributes; blocking either breaks layout.
//   img-src data: blob:         the owl artwork and inline placeholders; blob:
//     covers locally previewed evidence before upload.
//   media-src blob:             audio recorded in the browser (MediaRecorder)
//     is played back from a blob: URL before it is uploaded.
//   connect-src API_ORIGIN      every fetch goes to the API's origin.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${API_ORIGIN}`,
  `media-src 'self' blob: ${API_ORIGIN}`,
  `connect-src 'self' ${API_ORIGIN}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // frame-ancestors above is the modern control; this is for older browsers
  // that ignore it.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
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
