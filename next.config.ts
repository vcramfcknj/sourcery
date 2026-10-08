import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components kept off for the MVP: nearly every authenticated route
  // is cookie-gated (requireUser), which is exactly what PPR/caching is NOT
  // for. Standard request-time dynamic rendering is the correct semantics.
  // Revisit if public-page speed ever matters.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    // Pin the project root; auto-detection climbs into the OneDrive Desktop
    // and picks up an unrelated package-lock.json.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
