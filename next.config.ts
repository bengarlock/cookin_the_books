import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  basePath: "/cookinthebooks",
  reactStrictMode: true,
  experimental: {
    // Keep recently visited and explicitly prefetched dashboard pages warm for quick
    // back-and-forth navigation without holding financial data in the client for long.
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/",
        destination: "http://localhost:3000/cookinthebooks/local-apps",
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
