import type { NextConfig } from "next";
import path from "node:path";

// The Juu data API (backend/). The app reads it through /api/* so the browser needs no CORS.
const API = process.env.JUU_API_URL || "http://127.0.0.1:8788";

const config: NextConfig = {
  transpilePackages: ["@juu/ui"],
  agentRules: false,
  // Never show the Next.js dev badge (it only exists on local preview servers anyway).
  devIndicators: false,
  turbopack: { root: path.join(__dirname, "..") },
  // Positions became Portfolio; old links keep working (the query, e.g. ?stack=demo, is kept).
  async redirects() {
    return [
      { source: "/positions", destination: "/portfolio", permanent: true },
      // Swap lives in Portfolio's Swap tab.
      { source: "/swap", destination: "/portfolio?tab=swap", permanent: true },
      // The jackpot lives in Leaderboard's Jackpot tab.
      { source: "/jackpot", destination: "/leaderboard?tab=jackpot", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default config;
