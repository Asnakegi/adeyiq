import type { NextConfig } from "next";

/* AdeyIQ public pages are static HTML in public/adeyiq; these give them clean URLs.
   The home page is the modules landing page; the earlier dashboard lives at /dashboard. */
const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/adeyiq/home.html" },
        { source: "/build", destination: "/adeyiq/build.html" },
        { source: "/hold-view", destination: "/adeyiq/hold-view.html" },
        { source: "/aircraft-data", destination: "/adeyiq/aircraft-data.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
