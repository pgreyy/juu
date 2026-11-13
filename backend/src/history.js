// BTC price history: the keeper samples each stack's price feed every minute and keeps 7 days in
// data/price-history.json. The main stack reads Mezo's PriceFeed; the demo stack reads the demo feed.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, STACKS } from "./config.js";
import { stack, fmt } from "./chain.js";

const FILE = path.join(DATA_DIR, "price-history.json");
const KEEP = 7 * 24 * 60;
let samples = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];

export async function sample() {
  const row = { t: Math.floor(Date.now() / 1000) };
  for (const name of STACKS) {
    try {
      row[name] = fmt(await stack(name).priceFeed.fetchPrice());
    } catch {
      row[name] = null; // Mezo's feed refuses when the oracle is over 60 s old
    }
  }
  samples.push(row);
  if (samples.length > KEEP) samples = samples.slice(-KEEP);
  fs.writeFileSync(FILE, JSON.stringify(samples));
  return row;
}

export function history(stackName, minutes = 60) {
  const since = Math.floor(Date.now() / 1000) - minutes * 60;
  return samples.filter((r) => r.t >= since).map((r) => ({ t: r.t, price: r[stackName] }));
}
