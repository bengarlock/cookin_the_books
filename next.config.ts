import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  basePath: "/cookinthebooks",
  reactStrictMode: true,
  experimental: {
    // Keep recently visited dynamic dashboard pages warm for quick back-and-forth navigation.
    // Server-side financial reads remain no-store; the refresh control still invalidates the UI.
    staleTimes: {
      dynamic: 30,
      static: 300,
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
