import type { NextConfig } from "next";

/* AdeyIQ public pages are static HTML in public/adeyiq; these give them clean URLs.
   The home page is the modules landing page; the earlier dashboard lives at /dashboard. */

/* Pages use inline scripts, so 'unsafe-inline' stays; everything else is limited to AdeyIQ itself and Google Fonts.
   SheetJS is self-hosted (public/vendor/sheetjs), so no script CDN is allowed on the product pages. */
const csp = (scriptHosts: string[] = []) =>
  [
    "default-src 'self'",
    ["script-src 'self' 'unsafe-inline'", ...scriptHosts].join(" "),
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
const headersWith = (policy: string) => [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: policy },
];
/* the legacy optimizer demo (shown in /optimizer) still loads three.js and SheetJS from cdnjs; only it may */
const LEGACY = "adeyiq_cargo_optimizer_v[34]\.html";

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
    return [
      { source: "/", headers: headersWith(csp()) },
      { source: `/:path((?!${LEGACY}$).+)`, headers: headersWith(csp()) },
      { source: `/:file(${LEGACY})`, headers: headersWith(csp(["https://cdnjs.cloudflare.com"])) },
    ];
  },
};

export default nextConfig;
