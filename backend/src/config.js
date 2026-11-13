// Loads addresses and settings. Keys are read from the project's .env and never logged or returned by the API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(ROOT, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const fileEnv = loadEnv(path.resolve(ROOT, "..", ".env"));
export const env = (name, fallback) => process.env[name] ?? fileEnv[name] ?? fallback;

export const addresses = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "addresses.json"), "utf8"));
export const RPC_URL = env("MEZO_RPC_URL", "https://rpc.test.mezo.org");
export const PORT = Number(env("JUU_API_PORT", "8788"));
export const STACKS = Object.keys(addresses.stacks);
