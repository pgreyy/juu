#!/usr/bin/env node
// Juu MCP server: lets an AI assistant read Juu and play MUSDash through an agent session key.
//
// Settings (environment variables):
//   JUU_API_URL        Juu data API, default http://127.0.0.1:8788 (start it with `npm start` in backend/)
//   JUU_STACK          main or demo, default demo
//   AGENT_PRIVATE_KEY  the AGENT's own key (a fresh wallet the user granted a session to in the Agent Gateway).
//                      Never a user's main wallet key: the agent key can only do what the user's session allows,
//                      and the user can revoke it any time. Without it, only the read tools work.
//   MEZO_RPC_URL       default https://rpc.test.mezo.org
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const addresses = JSON.parse(fs.readFileSync(path.join(here, "..", "config", "addresses.json"), "utf8"));
const API = (process.env.JUU_API_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const STACK = process.env.JUU_STACK || "demo";
const RPC = process.env.MEZO_RPC_URL || "https://rpc.test.mezo.org";
if (!addresses.stacks[STACK]) throw new Error(`JUU_STACK must be one of ${Object.keys(addresses.stacks).join(", ")}`);
const stackAddr = addresses.stacks[STACK];

const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const agentKey = process.env.AGENT_PRIVATE_KEY;
const agent = agentKey ? new ethers.Wallet(agentKey, provider) : null;
const gateway = new ethers.Contract(
  stackAddr.gateway,
  [
    "function openMUSD(address user, uint8 side, uint8 floor, uint256 margin) returns (uint256)",
    "function openTokens(address user, uint8 side, uint8 floor, uint8 chip, uint256 seriesId, uint256 amount) returns (uint256)",
    "function close(uint256 id)",
    "function moveFloor(uint256 id, uint8 toFloor)",
    "function setLoopFor(address user, bool on, uint256 seriesId)",
    "function positions(uint256) view returns (address user, address agent, int256 cost, bool settled)",
    "event AgentOpened(uint256 indexed positionId, address indexed user, address indexed agent, uint8 side, uint8 floor, uint8 chip, uint256 seriesId, uint256 value)",
    "error NoSession()",
    "error Expired()",
    "error StoppedForToday()",
    "error FloorTooHigh()",
    "error BetTooBig()",
    "error NotYourPosition()",
    "error AlreadySettled()",
    "error LoopNotAllowed()",
  ],
  agent || provider,
);

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `Error: ${(e?.shortMessage || e?.reason || e?.message || String(e)).slice(0, 400)}` }] });

async function get(p) {
  const r = await fetch(`${API}${p}`);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}

function needAgent() {
  if (!agent) throw new Error("AGENT_PRIVATE_KEY is not set, so this server is read only. Set it to the agent's session key (never a user's main key).");
}

async function sendTx(fn, args) {
  needAgent();
  // Simulate first: the node returns the gateway's reason (for example FloorTooHigh) on a call, not on estimateGas.
  try {
    await gateway[fn].staticCall(...args);
  } catch (e) {
    const name = e?.revert?.name || (e?.data ? gateway.interface.parseError(e.data)?.name : null);
    throw new Error(name ? `refused by the Agent Gateway: ${name}` : e?.shortMessage || e?.message);
  }
  const est = await gateway[fn].estimateGas(...args);
  const tx = await gateway[fn](...args, { gasLimit: (est * 3n) / 2n });
  // Mezo's RPC sometimes fails a receipt lookup; poll and retry instead of failing.
  let r = null;
  for (let i = 0; i < 60 && !r; i++) {
    try {
      r = await provider.getTransactionReceipt(tx.hash);
    } catch {}
    if (!r) await new Promise((res) => setTimeout(res, 3000));
  }
  if (!r) return { tx: tx.hash, status: "sent, receipt not found yet", logs: [] };
  return { tx: tx.hash, status: r.status === 1 ? "success" : "failed", block: r.blockNumber, logs: r.logs };
}

const SIDES = { bull: 0, bear: 1 };
const CHIPS = { y: 1, p: 2 };
const server = new McpServer({ name: "juu", version: "0.1.0" });

// ---------------------------------------------------------------- read tools

const reads = [
  ["juu_floors", "Floor states: leverage, how far the price may move before a floor collapses, open positions and their collapse prices, seat premiums.", "/floors"],
  ["juu_sides", "Bull vs Bear open size, the gap the Bank carries and how much room is left.", "/sides"],
  ["juu_funding", "Current funding rate per hour for each side.", "/funding"],
  ["juu_climb_premium", "Climb Premium on floors 7-10: next seat price and kill switch status.", "/climb-premium"],
  ["juu_bank", "Bank capacity: capital, max gap, liquidity, its Mezo loan.", "/bank"],
  ["juu_jackpot", "Jackpot: Buffer size, target, current prize, recent draws.", "/jackpot"],
  ["juu_positions", "All open positions with live value, equity and collapse price.", "/positions"],
  ["juu_agent_fee", "The extra fee every agent action pays and how it is split.", "/agent-fee"],
];
for (const [name, description, p] of reads) {
  server.registerTool(name, { description, inputSchema: {} }, async () => {
    try {
      return text(await get(`/api/${STACK}${p}`));
    } catch (e) {
      return fail(e);
    }
  });
}

server.registerTool("juu_series", { description: "Series: end dates, phase, Y and P margin values, P Market price and fixed return, sMUSD series.", inputSchema: {} }, async () => {
  try {
    return text(await get("/api/series"));
  } catch (e) {
    return fail(e);
  }
});

server.registerTool(
  "juu_price_history",
  { description: "BTC price history sampled every minute.", inputSchema: { minutes: z.number().int().min(1).max(10080).default(60) } },
  async ({ minutes }) => {
    try {
      return text(await get(`/api/${STACK}/price/history?minutes=${minutes}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_recent_collapses",
  { description: "Recent floor collapses.", inputSchema: { limit: z.number().int().min(1).max(200).default(20) } },
  async ({ limit }) => {
    try {
      return text(await get(`/api/${STACK}/collapses/recent?limit=${limit}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_leaderboard",
  { description: "Leaderboard by realized profit: agents, humans or all.", inputSchema: { type: z.enum(["all", "agents", "humans"]).default("all") } },
  async ({ type }) => {
    try {
      return text(await get(`/api/${STACK}/leaderboard?type=${type}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_position",
  { description: "One position by id.", inputSchema: { id: z.number().int().min(1) } },
  async ({ id }) => {
    try {
      return text(await get(`/api/${STACK}/positions/${id}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_my_session",
  { description: "The rules a user gave this agent (max chips, highest floor, daily loss limit, expiry).", inputSchema: { user: z.string() } },
  async ({ user }) => {
    try {
      const all = await get(`/api/${STACK}/agents/${user}`);
      const mine = agent ? all.sessions.filter((s) => s.agent.toLowerCase() === agent.address.toLowerCase()) : all.sessions;
      return text({ agent: agent?.address ?? null, user, sessions: mine });
    } catch (e) {
      return fail(e);
    }
  },
);

// ---------------------------------------------------------------- action tools (agent session key only)

server.registerTool(
  "juu_open",
  {
    description: "Open a position for a user with their MUSD, through the Agent Gateway. Pays MUSDash's trading fee, the seat premium on floors 7-10, and the agent fee. The user's session rules apply.",
    inputSchema: { user: z.string(), side: z.enum(["bull", "bear"]), floor: z.number().int().min(1).max(10), margin_musd: z.number().positive() },
  },
  async ({ user, side, floor, margin_musd }) => {
    try {
      const r = await sendTx("openMUSD", [user, SIDES[side], floor, ethers.parseEther(String(margin_musd))]);
      const ev = r.logs.map((l) => { try { return gateway.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "AgentOpened");
      return text({ ...r, logs: undefined, positionId: ev ? Number(ev.args.positionId) : null });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_open_with_tokens",
  {
    description: "Open a position for a user with their Y or P chips of a series.",
    inputSchema: { user: z.string(), side: z.enum(["bull", "bear"]), floor: z.number().int().min(1).max(10), chip: z.enum(["y", "p"]), series_id: z.number().int().min(0), amount: z.number().positive() },
  },
  async ({ user, side, floor, chip, series_id, amount }) => {
    try {
      const r = await sendTx("openTokens", [user, SIDES[side], floor, CHIPS[chip], series_id, ethers.parseEther(String(amount))]);
      const ev = r.logs.map((l) => { try { return gateway.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "AgentOpened");
      return text({ ...r, logs: undefined, positionId: ev ? Number(ev.args.positionId) : null });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "juu_close",
  { description: "Close one of this agent's positions. Everything it returns goes to the user.", inputSchema: { id: z.number().int().min(1) } },
  async ({ id }) => {
    try {
      const r = await sendTx("close", [id]);
      return text({ ...r, logs: undefined });
    } catch (e) {
      return fail(e);
    }
  },
);

for (const [name, verb] of [["juu_climb", "Climb"], ["juu_drop", "Drop"]]) {
  server.registerTool(
    name,
    { description: `${verb} one of this agent's positions to another floor (within the user's highest floor).`, inputSchema: { id: z.number().int().min(1), to_floor: z.number().int().min(1).max(10) } },
    async ({ id, to_floor }) => {
      try {
        const r = await sendTx("moveFloor", [id, to_floor]);
        return text({ ...r, logs: undefined });
      } catch (e) {
        return fail(e);
      }
    },
  );
}

server.registerTool(
  "juu_set_loop",
  { description: "Turn the user's Loop on or off (only if the user allowed this agent to).", inputSchema: { user: z.string(), on: z.boolean(), series_id: z.number().int().min(0) } },
  async ({ user, on, series_id }) => {
    try {
      const r = await sendTx("setLoopFor", [user, on, series_id]);
      return text({ ...r, logs: undefined });
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool("juu_whoami", { description: "This server's stack, API and agent address (never any key).", inputSchema: {} }, async () =>
  text({ stack: STACK, api: API, gateway: stackAddr.gateway, agent: agent?.address ?? null, canAct: Boolean(agent) }),
);

await server.connect(new StdioServerTransport());
