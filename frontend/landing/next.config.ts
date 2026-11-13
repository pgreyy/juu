import type { NextConfig } from "next";
import path from "node:path";

// The landing reads live figures (ticker, leaderboard) from the Juu data API through /api/*.
const API = process.env.JUU_API_URL || "http://127.0.0.1:8788";

const config: NextConfig = {
  transpilePackages: ["@juu/ui"],
  agentRules: false,
  turbopack: { root: path.join(__dirname, "..") },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default config;
