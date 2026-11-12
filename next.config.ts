import type { NextConfig } from "next";

/* AdeyIQ public pages are static HTML in public/adeyiq; these give them clean URLs.
   The home page is the modules landing page; the earlier dashboard lives at /dashboard. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  /* pages use inline scripts and a few CDNs; this policy blocks framing by other sites and plugins,
     and limits where scripts, styles, fonts and network calls may come from */
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/adeyiq/home.html" },
        { source: "/build", destination: "/adeyiq/build.html" },
        { source: "/hold-view", destination: "/adeyiq/hold-view.html" },
        { source: "/aircraft-data", destination: "/adeyiq/aircraft-data.html" },
        { source: "/privacy", destination: "/adeyiq/privacy.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
