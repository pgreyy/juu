import type { NextConfig } from "next";
import path from "node:path";

// The landing reads live figures (ticker, leaderboard) from the Juu data API through /api/*.
const API = process.env.JUU_API_URL || "http://127.0.0.1:8788";

const config: NextConfig = {
  transpilePackages: ["@juu/ui"],
  agentRules: false,
  // Never show the Next.js dev badge (it only exists on local preview servers anyway).
  devIndicators: false,
  turbopack: { root: path.join(__dirname, "..") },
  // The docs are built from docs/gitbook; the MCP guide has the short address /docs/mcp.
  async redirects() {
    return [{ source: "/docs/agents/mcp", destination: "/docs/mcp", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default config;
