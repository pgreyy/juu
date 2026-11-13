// Incremental event scanner for each stack's MUSDash, Agent Gateway, Jackpot and Juu account factory.
// Keeps decoded events in memory and in data/events-<stack>.json, so restarts don't rescan from the start.
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { ABI } from "./abis.js";
import { DATA_DIR, addresses } from "./config.js";
import { provider } from "./chain.js";

const CHUNK = 9000; // Mezo's RPC accepts 10,000-block log queries
const ifaces = {
  game: new ethers.Interface(ABI.game),
  gateway: new ethers.Interface(ABI.gateway),
  jackpot: new ethers.Interface(ABI.jackpot),
  accountFactory: new ethers.Interface(ABI.accountFactory),
};

const state = {};

function file(stackName) {
  return path.join(DATA_DIR, `events-${stackName}.json`);
}

export function events(stackName) {
  if (!state[stackName]) {
    const f = file(stackName);
    state[stackName] = fs.existsSync(f)
      ? JSON.parse(fs.readFileSync(f, "utf8"))
      : { lastBlock: addresses.stacks[stackName].fromBlock - 1, list: [] };
  }
  return state[stackName];
}

function plain(v) {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}

/// Scans new blocks for one stack. Returns how many new events were stored.
export async function scan(stackName) {
  const s = events(stackName);
  const a = addresses.stacks[stackName];
  const sources = [
    [a.game, "game"],
    [a.gateway, "gateway"],
    [a.jackpot, "jackpot"],
  ];
  if (a.accountFactory) sources.push([a.accountFactory, "accountFactory"]);
  const latest = await provider.getBlockNumber();
  let added = 0;
  while (s.lastBlock < latest) {
    const from = s.lastBlock + 1;
    const to = Math.min(latest, from + CHUNK);
    const logs = await provider.getLogs({ address: sources.map((x) => x[0]), fromBlock: from, toBlock: to });
    for (const log of logs) {
      const kind = sources.find((x) => x[0].toLowerCase() === log.address.toLowerCase())?.[1];
      let parsed;
      try {
        parsed = ifaces[kind].parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;
      const args = {};
      parsed.fragment.inputs.forEach((inp, i) => (args[inp.name || `arg${i}`] = plain(parsed.args[i])));
      s.list.push({ source: kind, event: parsed.name, block: log.blockNumber, tx: log.transactionHash, args });
      added++;
    }
    s.lastBlock = to;
  }
  if (added > 0 || !fs.existsSync(file(stackName))) fs.writeFileSync(file(stackName), JSON.stringify(s));
  return added;
}

export function byEvent(stackName, source, name) {
  return events(stackName).list.filter((e) => e.source === source && e.event === name);
}
