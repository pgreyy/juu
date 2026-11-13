// pm2 processes for Juu on the server. Start or reload with: pm2 startOrReload deploy/ecosystem.config.cjs
// juu-backend = keeper bot + Data API (one Node process, 127.0.0.1:8788). juu-mcp = MCP server over HTTP (127.0.0.1:8789).
// juu-tunnel = Juu's Cloudflare tunnel (https://api.playjuu.xyz -> 127.0.0.1:8788).
// All read the settings in the repo's .env (owned by juu, mode 600).
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");

const common = {
  cwd: path.join(ROOT, "backend"),
  autorestart: true,
  restart_delay: 5000,
  exp_backoff_restart_delay: 2000,
  max_memory_restart: "700M",
  time: true,
  env: { NODE_ENV: "production" },
};

module.exports = {
  apps: [
    { ...common, name: "juu-backend", script: "src/index.js" },
    { ...common, name: "juu-mcp", script: "mcp/server.js", node_args: `--env-file=${ENV_FILE}`, env: { ...common.env, MCP_HTTP_PORT: "8789" } },
    { ...common, name: "juu-tunnel", cwd: ROOT, script: path.join(ROOT, "deploy/tunnel.sh"), interpreter: "bash", max_memory_restart: "300M" },
  ],
};
