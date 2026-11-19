import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* AdeyIQ public pages are static HTML in public/adeyiq; these give them clean URLs.
   The home page is the modules landing page; the earlier dashboard lives at /dashboard. */

/* Product pages: no 'unsafe-inline' for scripts. Each inline <script> block of public/adeyiq/*.html is allowed by its
   SHA-256 hash, computed here at build time from the same files that are served, so the list can never go stale.
   Line endings are normalised the way the HTML parser does before the browser hashes a script. */
const PAGES = join(process.cwd(), "public", "adeyiq");
const inlineScriptHashes = readdirSync(PAGES)
  .filter((f) => f.endsWith(".html"))
  .flatMap((f) => [...readFileSync(join(PAGES, f), "utf8").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]))
  .filter((code) => code.trim())
  .map((code) => `'sha256-${createHash("sha256").update(code.replace(/\r\n?/g, "\n"), "utf8").digest("base64")}'`);

const csp = (script: string) =>
  [
    "default-src 'self'",
    `script-src ${script}`,
    "worker-src 'self'",
    // style="" attributes are used throughout the pages; styles cannot run code
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
/* product pages: hashes only */
const PRODUCT = csp(["'self'", ...new Set(inlineScriptHashes)].join(" "));
/* Next.js demo dashboard pages inject their own inline bootstrap scripts, so they keep 'unsafe-inline' (no user data there) */
const APP = csp("'self' 'unsafe-inline'");
/* the legacy optimizer demo (shown in /optimizer) still loads three.js and SheetJS from cdnjs; only it may */
const LEGACY = csp("'self' 'unsafe-inline' https://cdnjs.cloudflare.com");
const LEGACY_FILES = "adeyiq_cargo_optimizer_v[34]\\.html";
const PRODUCT_PATHS = ["/", "/build", "/hold-view", "/aircraft-data", "/privacy", "/adeyiq/:path*", "/vendor/:path*"];

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
    // the three groups never overlap, so every response gets exactly one Content-Security-Policy
    return [
      ...PRODUCT_PATHS.map((source) => ({ source, headers: headersWith(PRODUCT) })),
      { source: `/:path((?!(?:build|hold-view|aircraft-data|privacy)$|adeyiq/|vendor/|${LEGACY_FILES}$).+)`, headers: headersWith(APP) },
      { source: `/:file(${LEGACY_FILES})`, headers: headersWith(LEGACY) },
    ];
  },
};

export default nextConfig;
