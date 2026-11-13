// Read-only data API for agents (and for checking Juu from Postman). Amounts are decimal numbers in MUSD or BTC.
import express from "express";
import { ethers } from "ethers";
import { ABI } from "./abis.js";
import { addresses, env, STACKS } from "./config.js";
import { c, fmt, now, provider, shared, stack } from "./chain.js";
import { byEvent, events } from "./events.js";
import { history } from "./history.js";
import { jobStatus, recentActions, warnings } from "./jobs.js";

const SIDE = ["Bull", "Bear"];
const CHIP = ["MUSD", "Y", "P"];
const PHASE = ["None", "Open", "Unlocking", "Matured"];
const iso = (t) => new Date(Number(t) * 1000).toISOString();

// Shared answer cache for the /api/* reads. Every visitor polls the same few URLs, and each answer takes several chain
// reads, so one answer is shared by everyone for a few seconds:
//   fresh (under API_CACHE_MS, default 3 s): served as is;
//   stale (under API_STALE_MS, default 60 s): served at once while one refresh runs in the background;
//   older or missing: computed, and everyone asking at the same moment waits for that one computation.
// Errors are never cached.
const CACHE_MS = Number(env("API_CACHE_MS", "") || 3000);
const STALE_MS = Number(env("API_STALE_MS", "") || 60000);
const cache = new Map(); // url -> { at, body, inflight }
const MAX_CACHE = 500;

function refresh(key, fn, req, res) {
  const entry = cache.get(key) || {};
  if (!entry.inflight) {
    entry.inflight = Promise.resolve()
      .then(() => fn(req, res))
      .then((body) => {
        cache.set(key, { at: Date.now(), body, inflight: null });
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
        return body;
      })
      .finally(() => {
        const e = cache.get(key);
        if (e) e.inflight = null;
      });
    cache.set(key, entry);
  }
  return entry.inflight;
}

function wrap(fn, { cached = true } = {}) {
  return async (req, res) => {
    try {
      if (!cached) return res.json(await fn(req, res));
      const key = req.originalUrl;
      const hit = cache.get(key);
      const age = hit?.body !== undefined ? Date.now() - hit.at : Infinity;
      if (age < CACHE_MS) return res.set("X-Cache", "fresh").json(hit.body);
      if (age < STALE_MS) {
        refresh(key, fn, req, res).catch(() => {});
        return res.set("X-Cache", "stale").json(hit.body);
      }
      res.set("X-Cache", "miss").json(await refresh(key, fn, req, res));
    } catch (e) {
      if (!res.headersSent) res.status(e.status || 500).json({ error: (e.shortMessage || e.message || String(e)).slice(0, 300) });
    }
  };
}

function st(req) {
  const name = req.params.stack;
  if (!STACKS.includes(name)) {
    const e = new Error(`unknown stack '${name}', use one of: ${STACKS.join(", ")}`);
    e.status = 404;
    throw e;
  }
  return stack(name);
}

async function positionRow(s, id) {
  const [p, live, gw] = await Promise.all([s.game.getPosition(id), s.game.positionValue(id).catch(() => null), s.gateway.positions(id).catch(() => null)]);
  const agent = p.owner.toLowerCase() === s.addr.gateway.toLowerCase() ? gw : null;
  return {
    id: Number(id),
    owner: p.owner,
    player: agent ? agent.user : p.owner,
    agent: agent ? agent.agent : null,
    isAgent: Boolean(agent),
    side: SIDE[Number(p.side)],
    floor: Number(p.floor),
    chip: CHIP[Number(p.chip)],
    seriesId: Number(p.chip) === 0 ? null : Number(p.seriesId),
    size: fmt(p.size),
    entryPrice: fmt(p.entryPrice),
    openedAt: iso(p.openedAt),
    chipValue: live ? fmt(live.tokenValue) : null,
    yRewardValue: live ? fmt(live.yRewardValue) : null,
    pnl: live ? fmt(live.pnl) : null,
    funding: live ? fmt(live.funding) : null,
    equity: live ? fmt(live.equity) : null,
    earned: live ? fmt(live.earned) : null,
    collapsePrice: live ? fmt(live.liquidationPrice) : null,
    collapseDue: live ? live.liquidatable : null,
  };
}

const blockTimes = new Map();
async function blockTime(n) {
  if (!blockTimes.has(n)) blockTimes.set(n, Number((await provider.getBlock(n)).timestamp));
  return blockTimes.get(n);
}

// Positions opened through the Agent Gateway: position id -> { user, agent }.
function agentPositions(stackName) {
  const m = new Map();
  for (const e of byEvent(stackName, "gateway", "AgentOpened")) m.set(String(e.args.positionId), { user: e.args.user, agent: e.args.agent });
  return m;
}

// Browsers may read the API from these sites (comma-separated origins, e.g. the two Vercel sites). The API is
// read only, so this only controls which web pages can fetch it directly.
const ORIGINS = env("CORS_ORIGINS", "")
  .split(",")
  .map((x) => x.trim().replace(/\/$/, ""))
  .filter(Boolean);

export function api() {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const o = req.get("origin");
    if (o && ORIGINS.includes(o)) {
      res.set("Access-Control-Allow-Origin", o);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/", (req, res) =>
    res.json({
      name: "Juu data API (read only)",
      stacks: STACKS,
      endpoints: [
        "GET /health",
        "GET /jobs",
        "GET /api/series",
        "GET /api/:stack/floors",
        "GET /api/:stack/sides",
        "GET /api/:stack/funding",
        "GET /api/:stack/climb-premium",
        "GET /api/:stack/bank",
        "GET /api/:stack/price/history?minutes=60",
        "GET /api/:stack/collapses/recent?limit=20",
        "GET /api/:stack/positions",
        "GET /api/:stack/positions/:id",
        "GET /api/:stack/jackpot",
        "GET /api/:stack/leaderboard?type=all|agents|humans",
        "GET /api/:stack/agents/:user",
        "GET /api/:stack/portfolio/:user",
        "GET /api/:stack/agent-fee",
        "GET /api/:stack/feed?limit=20",
        "GET /api/:stack/tickets/:user",
      ],
    }),
  );

  app.get("/health", wrap(async () => {
    const js = jobStatus();
    const block = await provider.getBlock("latest");
    const recent = warnings.filter((w) => Date.now() - w.at < 3600 * 1000);
    return {
      ok: js.every((j) => !j.late) && !recent.some((w) => w.level === "critical"),
      chainId: addresses.chainId,
      block: block.number,
      blockTime: iso(block.timestamp),
      jobsLate: js.filter((j) => j.late).map((j) => j.name),
      jobsFailing: js.filter((j) => j.lastError).map((j) => ({ name: j.name, error: j.lastError })),
      warningsLastHour: recent.slice(-20),
    };
  }, { cached: false }));

  app.get("/jobs", wrap(async () => ({ jobs: jobStatus(), recentActions: recentActions(), warnings: warnings.slice(-50).reverse() }), { cached: false }));

  app.get("/api/series", wrap(async () => {
    const t = await now();
    const sp = shared.splitter;
    const main = stack("main");
    const [n, m] = (await Promise.all([sp.seriesCount(), shared.savings.seriesCount()])).map(Number);
    const one = 10n ** 18n;
    const ve = await Promise.all(
      Array.from({ length: n }, async (_, id) => {
        const [s, yVal, pVal, weeks, poolPrice, implied, locked, pool] = await Promise.all([
          sp.getSeries(id),
          main.pricer.yValue(id, one).catch(() => 0n),
          main.pricer.pValue(id, one).catch(() => 0n),
          main.pricer.yieldWeeksLeft(id).catch(() => 0n),
          shared.pmarket.priceOfP(id).catch(() => 0n),
          shared.pmarket.impliedReturn(id).catch(() => [0n, 0n]),
          sp.lockedBTC(id),
          shared.pmarket.poolOf(id),
        ]);
        return {
          kind: "veBTC",
          id,
          endDate: iso(s.end),
          phase: PHASE[Number(s.phase)],
          unlockFrom: iso(Number(s.end) - 30 * 86400),
          lockEnd: s.lockEnd > 0n ? iso(s.lockEnd) : null,
          btcLocked: fmt(locked),
          pToken: s.p,
          yToken: s.y,
          yMarginValuePerY: fmt(yVal),
          yieldWeeksLeft: fmt(weeks),
          pMarginValuePerP: fmt(pVal),
          pMarket: { pool, btcPerP: fmt(poolPrice), fixedReturnToEnd: fmt(implied[0]) },
          btcStaysInJuuUntil: iso(s.end),
        };
      }),
    );
    const sv = shared.savings;
    const sm = await Promise.all(Array.from({ length: m }, (_, id) => sv.getSeries(id)));
    const out = [
      ...ve,
      ...sm.map((s, id) => ({ kind: "sMUSD", id, endDate: iso(s.end), matured: s.matured, principalMUSD: fmt(s.principal), pToken: s.p, yToken: s.y, musdStaysInJuuUntil: iso(s.end) })),
    ];
    return { now: iso(t), series: out };
  }));

  app.get("/api/:stack/floors", wrap(async (req) => {
    const s = st(req);
    // Every chain read at once (ethers sends them to Mezo as one batch).
    const F = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [mmRaw, priceRaw, ids, levs, sizes, premiums] = await Promise.all([
      s.game.maintenanceMargin(),
      s.priceFeed.fetchPrice(),
      s.game.openPositionIds(),
      Promise.all(F.map((f) => s.game.leverage(f - 1))),
      Promise.all(F.map((f) => s.game.floorSize(f))),
      Promise.all(F.map((f) => (f >= 7 ? s.game.seatPremium(f) : 0n))),
    ]);
    const mm = fmt(mmRaw);
    const price = fmt(priceRaw);
    const rows = await Promise.all(ids.map((id) => positionRow(s, id)));
    const floors = F.map((f, i) => {
      const lev = fmt(levs[i]);
      const move = 1 / lev - mm;
      return {
        floor: f,
        leverage: lev,
        collapseMove: move,
        collapsePriceForNewBull: price * (1 - move),
        collapsePriceForNewBear: price * (1 + move),
        openSize: fmt(sizes[i]),
        seatPremium: f >= 7 ? fmt(premiums[i]) : 0,
        positions: rows.filter((r) => r.floor === f).map((r) => ({ id: r.id, side: r.side, size: r.size, collapsePrice: r.collapsePrice, isAgent: r.isAgent })),
      };
    });
    return { stack: s.name, price, maintenanceMargin: mm, floors };
  }));

  app.get("/api/:stack/sides", wrap(async (req) => {
    const s = st(req);
    const [bull, bear, gap, maxExp] = await Promise.all([s.game.openInterest(0), s.game.openInterest(1), s.game.imbalance(), s.bank.maxExposure()]);
    return { stack: s.name, bull: fmt(bull), bear: fmt(bear), gap: fmt(gap), bankMaxGap: fmt(maxExp), roomLeft: Math.max(0, fmt(maxExp) - fmt(gap)) };
  }));

  app.get("/api/:stack/funding", wrap(async (req) => {
    const s = st(req);
    const [rates, k, last] = await Promise.all([s.game.fundingRates(), s.game.fundingK(), s.game.lastFundingTime()]);
    return { stack: s.name, bullPaysPerHour: fmt(rates[0]), bearPaysPerHour: fmt(rates[1]), k: fmt(k), lastUpdate: iso(last), note: "positive = pays, negative = receives; share of position size per hour" };
  }));

  app.get("/api/:stack/climb-premium", wrap(async (req) => {
    const s = st(req);
    const [eRaw, lenRaw, on, base, growth, kill] = await Promise.all([
      s.game.currentEpoch(), s.game.epochLength(), s.game.premiumOn(), s.game.premiumBase(), s.game.premiumGrowth(), s.game.killLevel(),
    ]);
    const e = Number(eRaw);
    const len = Number(lenRaw);
    const TOP = [7, 8, 9, 10];
    const [seats, prems, topNow, topLast] = await Promise.all([
      Promise.all(TOP.map((f) => s.game.seatsTaken(e, f))),
      Promise.all(TOP.map((f) => s.game.seatPremium(f))),
      s.game.topSeats(e),
      e > 0 ? s.game.topSeats(e - 1) : 0n,
    ]);
    return {
      stack: s.name,
      premiumOn: on,
      killSwitch: on ? "armed (premium on)" : "tripped (premium off for good)",
      base: fmt(base),
      growthPerSeat: fmt(growth),
      killLevel: fmt(kill),
      epoch: e,
      epochEnds: iso((e + 1) * len),
      epochLengthSeconds: len,
      topSeatsThisEpoch: Number(topNow),
      topSeatsLastEpoch: Number(topLast),
      floors: TOP.map((f, i) => ({ floor: f, seatsThisEpoch: Number(seats[i]), nextSeatPremium: fmt(prems[i]) })),
    };
  }));

  app.get("/api/:stack/bank", wrap(async (req) => {
    const s = st(req);
    const [reserve, reserveShare, maxWin] = await Promise.all([s.bank.reserveTarget(), s.bank.reserveShare(), s.game.maxWinShare()]);
    const [capital, maxExp, liq, trove, cr, target, gap, tokens] = await Promise.all([
      s.bank.capitalMUSD(),
      s.bank.maxExposure(),
      s.bank.liquidity(),
      s.bank.trove(),
      s.bank.collateralRatio(),
      s.bank.targetCR(),
      s.game.imbalance(),
      s.bank.tokenValueMUSD(),
    ]);
    return {
      stack: s.name,
      capitalMUSD: fmt(capital),
      maxGapMUSD: fmt(maxExp),
      currentGapMUSD: fmt(gap),
      roomLeftMUSD: Math.max(0, fmt(maxExp) - fmt(gap)),
      liquidityMUSD: fmt(liq),
      cashReserve: { targetMUSD: fmt(reserve), share: fmt(reserveShare), short: liq < reserve },
      winCapShareOfSize: fmt(maxWin),
      largestBetSizeNowMUSD: fmt(liq) / fmt(maxWin),
      yAndPHeldMUSD: fmt(tokens),
      trove: { collateralBTC: fmt(trove.coll), debtMUSD: fmt(trove.debt), collateralRatio: fmt(cr), target: fmt(target) },
    };
  }));

  app.get("/api/:stack/price/history", wrap(async (req) => {
    const s = st(req);
    const minutes = Math.min(Number(req.query.minutes || 60), 7 * 24 * 60);
    return { stack: s.name, minutes, samples: history(s.name, minutes) };
  }));

  app.get("/api/:stack/collapses/recent", wrap(async (req) => {
    const s = st(req);
    const limit = Math.min(Number(req.query.limit || 20), 200);
    const list = byEvent(s.name, "game", "FloorCollapsed").slice(-limit).reverse();
    return {
      stack: s.name,
      collapses: list.map((e) => ({ id: Number(e.args.id), owner: e.args.owner, equity: fmt(e.args.equity), toSurvivors: fmt(e.args.toSurvivors), toBuffer: fmt(e.args.toBuffer), toBank: fmt(e.args.toBank), badDebt: fmt(e.args.badDebt), price: fmt(e.args.price), block: e.block, tx: e.tx })),
    };
  }));

  app.get("/api/:stack/positions", wrap(async (req) => {
    const s = st(req);
    const ids = await s.game.openPositionIds();
    return { stack: s.name, positions: await Promise.all(ids.map((id) => positionRow(s, id))) };
  }));

  app.get("/api/:stack/positions/:id", wrap(async (req) => {
    const s = st(req);
    const p = await s.game.getPosition(req.params.id);
    if (p.owner === ethers.ZeroAddress) return { stack: s.name, id: Number(req.params.id), open: false };
    return { stack: s.name, open: true, ...(await positionRow(s, req.params.id)) };
  }));

  app.get("/api/:stack/jackpot", wrap(async (req) => {
    const s = st(req);
    const [eRaw, lenRaw, buffer, target, surplus] = await Promise.all([
      s.game.currentEpoch(), s.game.epochLength(), s.buffer.balance(), s.jackpot.getFunction("target")(), s.jackpot.surplus(),
    ]);
    const e = Number(eRaw);
    const len = Number(lenRaw);
    const draws = byEvent(s.name, "jackpot", "Drawn").slice(-10).reverse();
    return {
      stack: s.name,
      epoch: e,
      epochEnds: iso((e + 1) * len),
      bufferMUSD: fmt(buffer),
      targetMUSD: fmt(target),
      jackpotNowMUSD: fmt(surplus),
      committed: (await s.jackpot.commitOf(e)) !== ethers.ZeroHash,
      recentDraws: draws.map((d) => ({ epoch: Number(d.args.epoch), winner: d.args.winner, positionId: Number(d.args.positionId), prize: fmt(d.args.prize), totalTickets: d.args.totalTickets, tx: d.tx })),
    };
  }));

  app.get("/api/:stack/leaderboard", wrap(async (req) => {
    const s = st(req);
    const type = String(req.query.type || "all");
    const gw = s.addr.gateway.toLowerCase();
    const humans = new Map();
    for (const e of byEvent(s.name, "game", "Result")) {
      if (e.args.owner.toLowerCase() === gw) continue;
      const r = humans.get(e.args.owner) || { player: e.args.owner, kind: "human", profitMUSD: 0, steps: 0 };
      r.profitMUSD += fmt(e.args.result);
      r.steps++;
      humans.set(e.args.owner, r);
    }
    const agents = new Map();
    for (const e of [...byEvent(s.name, "gateway", "AgentClosed"), ...byEvent(s.name, "gateway", "AgentLiquidated")]) {
      const r = agents.get(e.args.agent) || { player: e.args.agent, kind: "agent", playsFor: new Set(), profitMUSD: 0, positions: 0 };
      r.profitMUSD += fmt(e.args.result);
      r.positions++;
      r.playsFor.add(e.args.user);
      agents.set(e.args.agent, r);
    }
    // Highest floor each player (or agent) has reached: from opens and climbs.
    const ap = agentPositions(s.name);
    const best = new Map();
    for (const e of events(s.name).list) {
      if (e.source !== "game" || (e.event !== "Opened" && e.event !== "Agaruzo")) continue;
      const g = ap.get(String(e.args.id));
      const who = (g ? g.agent : e.args.owner).toLowerCase();
      const f = Number(e.event === "Opened" ? e.args.floor : e.args.toFloor);
      best.set(who, Math.max(best.get(who) || 0, f));
    }
    for (const r of humans.values()) r.bestFloor = best.get(r.player.toLowerCase()) || null;
    for (const r of agents.values()) r.bestFloor = best.get(r.player.toLowerCase()) || null;
    const agentRows = [...agents.values()].map((r) => ({ ...r, playsFor: [...r.playsFor] }));
    const rows = type === "agents" ? agentRows : type === "humans" ? [...humans.values()] : [...agentRows, ...humans.values()];
    rows.sort((a, b) => b.profitMUSD - a.profitMUSD);
    return {
      stack: s.name,
      type,
      note: "Realized profit in MUSD. Humans: sum of MUSDash Result events (fees, premiums, gains, losses, rewards). Agents: gateway results, which also include the agent fee. Agent positions are labelled on chain by the gateway's events.",
      scannedToBlock: events(s.name).lastBlock,
      ranking: rows.map((r, i) => ({ rank: i + 1, ...r })),
    };
  }));

  app.get("/api/:stack/agents/:user", wrap(async (req) => {
    const s = st(req);
    const user = req.params.user.toLowerCase();
    const agents = new Set(byEvent(s.name, "gateway", "SessionGranted").filter((e) => e.args.user.toLowerCase() === user).map((e) => e.args.agent));
    // Net result today (UTC day, the same day the gateway's loss stop uses): every close and collapse settled today,
    // gains and losses together.
    const today = Math.floor((await now()) / 86400);
    const settled = [...byEvent(s.name, "gateway", "AgentClosed"), ...byEvent(s.name, "gateway", "AgentLiquidated")].filter((e) => e.args.user.toLowerCase() === user);
    const net = new Map();
    for (const e of settled) {
      if (Math.floor((await blockTime(e.block)) / 86400) !== today) continue;
      const k = e.args.agent.toLowerCase();
      net.set(k, (net.get(k) || 0) + fmt(e.args.result));
    }
    const out = [];
    for (const agent of agents) {
      const x = await s.gateway.session(req.params.user, agent);
      // The gateway resets lossToday lazily, on the agent's next move; a value from an earlier day is 0 today.
      const lossToday = Number(x.day) === today ? fmt(x.lossToday) : 0;
      out.push({ agent, active: x.active, expires: iso(x.expiry), maxChipsMUSD: fmt(x.maxChips), maxFloor: Number(x.maxFloor), dailyLossLimitMUSD: fmt(x.dailyLossLimit), lossTodayMUSD: lossToday, netTodayMUSD: net.get(agent.toLowerCase()) || 0, canSetLoop: x.canSetLoop });
    }
    return { stack: s.name, user: req.params.user, sessions: out };
  }));

  app.get("/api/:stack/agent-fee", wrap(async (req) => {
    const s = st(req);
    return { stack: s.name, rateOfSize: fmt(await s.gateway.agentFeeRate()), minimumMUSD: fmt(await s.gateway.agentFeeMin()), toBuffer: fmt(await s.gateway.agentFeeToBuffer()), toBank: 1 - fmt(await s.gateway.agentFeeToBuffer()) };
  }));

  // Recent game moves for the live feed: opens, climbs (Agaruzo), drops, closes, collapses and jackpot draws.
  app.get("/api/:stack/feed", wrap(async (req) => {
    const s = st(req);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const agents = agentPositions(s.name);
    const pos = new Map();
    const items = [];
    for (const e of events(s.name).list) {
      const a = e.args;
      const who = (id, owner) => {
        const g = agents.get(String(id));
        return g ? { player: g.user, agent: g.agent, isAgent: true } : { player: owner, agent: null, isAgent: false };
      };
      const base = { block: e.block, tx: e.tx };
      if (e.source === "game" && e.event === "Opened") {
        const p = { side: SIDE[Number(a.side)], floor: Number(a.floor), chip: CHIP[Number(a.chip)] };
        pos.set(String(a.id), p);
        items.push({ kind: "open", id: Number(a.id), ...who(a.id, a.owner), ...p, size: fmt(a.size), price: fmt(a.price), ...base });
      } else if (e.source === "game" && (e.event === "Agaruzo" || e.event === "Dropped")) {
        const p = pos.get(String(a.id)) || {};
        p.floor = Number(a.toFloor);
        items.push({ kind: e.event === "Agaruzo" ? "climb" : "drop", id: Number(a.id), ...who(a.id, a.owner), side: p.side || null, fromFloor: Number(a.fromFloor), floor: Number(a.toFloor), size: fmt(a.size), price: fmt(a.price), ...base });
      } else if (e.source === "game" && e.event === "Closed") {
        const p = pos.get(String(a.id)) || {};
        items.push({ kind: "close", id: Number(a.id), ...who(a.id, a.owner), side: p.side || null, floor: p.floor || null, pnl: fmt(a.pnl), price: fmt(a.price), ...base });
      } else if (e.source === "game" && e.event === "FloorCollapsed") {
        const p = pos.get(String(a.id)) || {};
        items.push({ kind: "collapse", id: Number(a.id), ...who(a.id, a.owner), side: p.side || null, floor: p.floor || null, toSurvivors: fmt(a.toSurvivors), badDebt: fmt(a.badDebt), price: fmt(a.price), ...base });
      } else if (e.source === "jackpot" && e.event === "Drawn") {
        items.push({ kind: "jackpot", epoch: Number(a.epoch), player: a.winner, isAgent: false, prize: fmt(a.prize), ...base });
      }
    }
    const out = items.slice(-limit).reverse();
    await Promise.all(out.map(async (x) => (x.time = iso(await blockTime(x.block)))));
    return { stack: s.name, scannedToBlock: events(s.name).lastBlock, feed: out };
  }));

  // One player's Juu activity and today's realized result, for the Portfolio page. Opens, climbs, drops, cash outs and
  // collapses (their own bets and their agents'), Bank deposits and withdrawals, jackpot wins. Today = UTC day.
  app.get("/api/:stack/portfolio/:user", wrap(async (req) => {
    const s = st(req);
    const user = req.params.user.toLowerCase();
    const limit = Math.min(Number(req.query.limit || 30), 200);
    const agents = agentPositions(s.name);
    const mine = (id, owner) => {
      const g = agents.get(String(id));
      return g ? g.user.toLowerCase() === user : owner.toLowerCase() === user;
    };
    const byAgent = (id) => agents.get(String(id))?.agent || null;
    const pos = new Map();
    const items = [];
    const results = [];
    for (const e of events(s.name).list) {
      const a = e.args;
      const base = { block: e.block, tx: e.tx };
      if (e.source === "game") {
        if (e.event === "Opened") pos.set(String(a.id), { side: SIDE[Number(a.side)], floor: Number(a.floor), chip: CHIP[Number(a.chip)] });
        if (!["Opened", "Agaruzo", "Dropped", "Closed", "FloorCollapsed", "Result"].includes(e.event) || !mine(a.id, a.owner)) continue;
        const p = pos.get(String(a.id)) || {};
        const who = { id: Number(a.id), agent: byAgent(a.id), side: p.side || null };
        if (e.event === "Opened") items.push({ kind: "open", ...who, floor: Number(a.floor), chip: p.chip, sizeMUSD: fmt(a.size), ...base });
        else if (e.event === "Agaruzo" || e.event === "Dropped") {
          p.floor = Number(a.toFloor);
          items.push({ kind: e.event === "Agaruzo" ? "climb" : "drop", ...who, fromFloor: Number(a.fromFloor), floor: Number(a.toFloor), ...base });
        } else if (e.event === "Closed") items.push({ kind: "cashout", ...who, floor: p.floor ?? null, musdOut: fmt(a.musdOut), ...base });
        else if (e.event === "FloorCollapsed") items.push({ kind: "collapse", ...who, floor: p.floor ?? null, ...base });
        else if (e.event === "Result") results.push({ id: Number(a.id), result: fmt(a.result), block: e.block });
      } else if (e.source === "bank" && e.event === "Deposited" && a.receiver.toLowerCase() === user) {
        items.push({ kind: "deposit", btc: fmt(a.btc), shares: fmt(a.shares), ...base });
      } else if (e.source === "bank" && e.event === "Withdrawn" && a.owner.toLowerCase() === user) {
        items.push({ kind: "withdraw", btc: fmt(a.btc), musdOut: fmt(a.musdOut), ...base });
      } else if (e.source === "jackpot" && e.event === "Drawn" && a.winner.toLowerCase() === user) {
        items.push({ kind: "jackpot", prizeMUSD: fmt(a.prize), ...base });
      }
    }
    // Attach each bet's realized result to its cash out or collapse.
    const res = new Map(results.map((r) => [r.id, r.result]));
    for (const it of items) if ((it.kind === "cashout" || it.kind === "collapse") && res.has(it.id)) it.resultMUSD = res.get(it.id);
    const today = Math.floor((await now()) / 86400);
    let realizedTodayMUSD = 0;
    for (const r of results) if (Math.floor((await blockTime(r.block)) / 86400) === today) realizedTodayMUSD += r.result;
    const out = items.slice(-limit).reverse();
    await Promise.all(out.map(async (x) => (x.time = iso(await blockTime(x.block)))));
    return { stack: s.name, user: req.params.user, realizedTodayMUSD, activity: out };
  }));

  // Jackpot tickets this epoch for one player. 1 ticket = 1 MUSD of position size held for 1 hour.
  // Counts the sealed ledger (closed or moved positions) plus every open position's time so far.
  app.get("/api/:stack/tickets/:user", wrap(async (req) => {
    const s = st(req);
    const user = req.params.user.toLowerCase();
    const agents = agentPositions(s.name);
    const owner = (id, o) => (agents.get(String(id))?.user || o).toLowerCase();
    const [e, len, t] = [Number(await s.game.currentEpoch()), Number(await s.game.epochLength()), await now()];
    const start = e * len;
    const n = Number(await s.game.ticketCount(e));
    const ledger = await Promise.all(Array.from({ length: n }, (_, i) => s.game.ticketAt(e, i)));
    let all = 0n, mine = 0n, prior = 0n;
    for (const tk of ledger) {
      const amt = tk.cum - prior;
      prior = tk.cum;
      all += amt;
      if (owner(tk.positionId, tk.owner) === user) mine += amt;
    }
    const ids = await s.game.openPositionIds();
    const open = await Promise.all(ids.map(async (id) => [id, await s.game.getPosition(id)]));
    for (const [id, p] of open) {
      const from = Math.max(Number(p.ticketsFrom), start);
      if (t <= from) continue;
      const amt = p.size * BigInt(t - from);
      all += amt;
      if (owner(id, p.owner) === user) mine += amt;
    }
    const toTickets = (x) => fmt(x) / 3600;
    return {
      stack: s.name,
      epoch: e,
      drawAfter: iso((e + 1) * len),
      unit: "1 ticket = 1 MUSD of position size held for 1 hour",
      yourTickets: toTickets(mine),
      allTickets: toTickets(all),
      yourOdds: all > 0n ? Number((mine * 1000000n) / all) / 1000000 : 0,
    };
  }));

  return app;
}
