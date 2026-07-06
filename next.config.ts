import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  basePath: "/cookinthebooks",
  reactStrictMode: true,
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
