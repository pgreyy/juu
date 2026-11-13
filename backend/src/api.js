// Read-only data API for agents (and for checking Juu from Postman). Amounts are decimal numbers in MUSD or BTC.
import express from "express";
import { ethers } from "ethers";
import { ABI } from "./abis.js";
import { addresses, STACKS } from "./config.js";
import { c, fmt, now, provider, shared, stack } from "./chain.js";
import { byEvent, events } from "./events.js";
import { history } from "./history.js";
import { jobStatus, recentActions, warnings } from "./jobs.js";

const SIDE = ["Bull", "Bear"];
const CHIP = ["MUSD", "Y", "P"];
const PHASE = ["None", "Open", "Unlocking", "Matured"];
const iso = (t) => new Date(Number(t) * 1000).toISOString();

function wrap(fn) {
  return async (req, res) => {
    try {
      res.json(await fn(req, res));
    } catch (e) {
      res.status(e.status || 500).json({ error: (e.shortMessage || e.message || String(e)).slice(0, 300) });
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
  const p = await s.game.getPosition(id);
  let live = null;
  try {
    live = await s.game.positionValue(id);
  } catch {}
  const agent = p.owner.toLowerCase() === s.addr.gateway.toLowerCase() ? await s.gateway.positions(id) : null;
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

export function api() {
  const app = express();

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
        "GET /api/:stack/agent-fee",
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
  }));

  app.get("/jobs", wrap(async () => ({ jobs: jobStatus(), recentActions: recentActions(), warnings: warnings.slice(-50).reverse() })));

  app.get("/api/series", wrap(async () => {
    const t = await now();
    const sp = shared.splitter;
    const main = stack("main");
    const out = [];
    const n = Number(await sp.seriesCount());
    for (let id = 0; id < n; id++) {
      const s = await sp.getSeries(id);
      const one = 10n ** 18n;
      const [yVal, pVal, weeks, poolPrice, implied] = await Promise.all([
        main.pricer.yValue(id, one).catch(() => 0n),
        main.pricer.pValue(id, one).catch(() => 0n),
        main.pricer.yieldWeeksLeft(id).catch(() => 0n),
        shared.pmarket.priceOfP(id).catch(() => 0n),
        shared.pmarket.impliedReturn(id).catch(() => [0n, 0n]),
      ]);
      out.push({
        kind: "veBTC",
        id,
        endDate: iso(s.end),
        phase: PHASE[Number(s.phase)],
        unlockFrom: iso(Number(s.end) - 30 * 86400),
        lockEnd: s.lockEnd > 0n ? iso(s.lockEnd) : null,
        btcLocked: fmt(await sp.lockedBTC(id)),
        pToken: s.p,
        yToken: s.y,
        yMarginValuePerY: fmt(yVal),
        yieldWeeksLeft: fmt(weeks),
        pMarginValuePerP: fmt(pVal),
        pMarket: { pool: await shared.pmarket.poolOf(id), btcPerP: fmt(poolPrice), fixedReturnToEnd: fmt(implied[0]) },
        btcStaysInJuuUntil: iso(s.end),
      });
    }
    const sv = shared.savings;
    const m = Number(await sv.seriesCount());
    for (let id = 0; id < m; id++) {
      const s = await sv.getSeries(id);
      out.push({ kind: "sMUSD", id, endDate: iso(s.end), matured: s.matured, principalMUSD: fmt(s.principal), pToken: s.p, yToken: s.y, musdStaysInJuuUntil: iso(s.end) });
    }
    return { now: iso(t), series: out };
  }));

  app.get("/api/:stack/floors", wrap(async (req) => {
    const s = st(req);
    const mm = fmt(await s.game.maintenanceMargin());
    const price = fmt(await s.priceFeed.fetchPrice());
    const ids = await s.game.openPositionIds();
    const rows = await Promise.all(ids.map((id) => positionRow(s, id)));
    const floors = [];
    for (let f = 1; f <= 10; f++) {
      const lev = fmt(await s.game.leverage(f - 1));
      const move = 1 / lev - mm;
      const onFloor = rows.filter((r) => r.floor === f);
      floors.push({
        floor: f,
        leverage: lev,
        collapseMove: move,
        collapsePriceForNewBull: price * (1 - move),
        collapsePriceForNewBear: price * (1 + move),
        openSize: fmt(await s.game.floorSize(f)),
        seatPremium: f >= 7 ? fmt(await s.game.seatPremium(f)) : 0,
        positions: onFloor.map((r) => ({ id: r.id, side: r.side, size: r.size, collapsePrice: r.collapsePrice, isAgent: r.isAgent })),
      });
    }
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
    const e = Number(await s.game.currentEpoch());
    const len = Number(await s.game.epochLength());
    const floors = [];
    for (let f = 7; f <= 10; f++) floors.push({ floor: f, seatsThisEpoch: Number(await s.game.seatsTaken(e, f)), nextSeatPremium: fmt(await s.game.seatPremium(f)) });
    return {
      stack: s.name,
      premiumOn: await s.game.premiumOn(),
      killSwitch: (await s.game.premiumOn()) ? "armed (premium on)" : "tripped (premium off for good)",
      base: fmt(await s.game.premiumBase()),
      growthPerSeat: fmt(await s.game.premiumGrowth()),
      killLevel: fmt(await s.game.killLevel()),
      epoch: e,
      epochEnds: iso((e + 1) * len),
      epochLengthSeconds: len,
      topSeatsThisEpoch: Number(await s.game.topSeats(e)),
      topSeatsLastEpoch: e > 0 ? Number(await s.game.topSeats(e - 1)) : 0,
      floors,
    };
  }));

  app.get("/api/:stack/bank", wrap(async (req) => {
    const s = st(req);
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
    const e = Number(await s.game.currentEpoch());
    const len = Number(await s.game.epochLength());
    const draws = byEvent(s.name, "jackpot", "Drawn").slice(-10).reverse();
    return {
      stack: s.name,
      epoch: e,
      epochEnds: iso((e + 1) * len),
      bufferMUSD: fmt(await s.buffer.balance()),
      targetMUSD: fmt(await s.jackpot.getFunction("target")()),
      jackpotNowMUSD: fmt(await s.jackpot.surplus()),
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
    const out = [];
    for (const agent of agents) {
      const x = await s.gateway.session(req.params.user, agent);
      out.push({ agent, active: x.active, expires: iso(x.expiry), maxChipsMUSD: fmt(x.maxChips), maxFloor: Number(x.maxFloor), dailyLossLimitMUSD: fmt(x.dailyLossLimit), lossTodayMUSD: fmt(x.lossToday), canSetLoop: x.canSetLoop });
    }
    return { stack: s.name, user: req.params.user, sessions: out };
  }));

  app.get("/api/:stack/agent-fee", wrap(async (req) => {
    const s = st(req);
    return { stack: s.name, rateOfSize: fmt(await s.gateway.agentFeeRate()), minimumMUSD: fmt(await s.gateway.agentFeeMin()), toBuffer: fmt(await s.gateway.agentFeeToBuffer()), toBank: 1 - fmt(await s.gateway.agentFeeToBuffer()) };
  }));

  return app;
}
