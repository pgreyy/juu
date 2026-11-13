import type { NextConfig } from "next";
import path from "node:path";

// The Juu data API (backend/). The app reads it through /api/* so the browser needs no CORS.
const API = process.env.JUU_API_URL || "http://127.0.0.1:8788";

const config: NextConfig = {
  transpilePackages: ["@juu/ui"],
  agentRules: false,
  turbopack: { root: path.join(__dirname, "..") },
  // Positions became Portfolio; old links keep working (the query, e.g. ?stack=demo, is kept).
  async redirects() {
    return [{ source: "/positions", destination: "/portfolio", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default config;
