// The keeper: scheduled jobs that keep Juu running. Each job records when it last ran, succeeded and failed;
// failures, late jobs and payouts at risk of slipping become warnings, shown on /health and /jobs.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ethers } from "ethers";
import { ABI } from "./abis.js";
import { addresses, DATA_DIR, STACKS } from "./config.js";
import { c, fmt, now, provider, send, shared, stack } from "./chain.js";
import { byEvent, scan } from "./events.js";
import { sample } from "./history.js";

const WEEK = 604800;
const HOUR = 3600;
const STATE_FILE = path.join(DATA_DIR, "keeper-state.json");
const SECRETS_FILE = path.join(DATA_DIR, "jackpot-secrets.json"); // the keeper's own random draw secrets
const kv = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const secrets = fs.existsSync(SECRETS_FILE) ? JSON.parse(fs.readFileSync(SECRETS_FILE, "utf8")) : {};
const saveKv = () => fs.writeFileSync(STATE_FILE, JSON.stringify(kv, null, 1));
const saveSecrets = () => fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets), { mode: 0o600 });

export const jobs = new Map();
export const warnings = [];
const actions = []; // recent transactions the keeper sent

export function warn(job, level, message) {
  const last = warnings[warnings.length - 1];
  if (last && last.job === job && last.message === message && Date.now() - last.at < 10 * 60 * 1000) return;
  warnings.push({ at: Date.now(), time: new Date().toISOString(), job, level, message });
  if (warnings.length > 200) warnings.shift();
  console.log(`[${level}] ${job}: ${message}`);
}

async function act(job, label, contract, fn, args = [], opts = {}) {
  const r = await send(contract, fn, args, opts);
  const row = { time: new Date().toISOString(), job, label, tx: r.hash, block: r.blockNumber };
  actions.push(row);
  if (actions.length > 300) actions.shift();
  console.log(`[tx] ${job}: ${label} ${r.hash}`);
  return r;
}

function register(name, everySec, description, fn) {
  jobs.set(name, { name, everySec, description, fn, runs: 0, fails: 0, lastRun: null, lastOk: null, lastError: null, running: false });
}

export async function runJob(name) {
  const j = jobs.get(name);
  if (!j || j.running) return;
  j.running = true;
  j.lastRun = Date.now();
  j.runs++;
  try {
    await j.fn();
    j.lastOk = Date.now();
    j.lastError = null;
  } catch (e) {
    j.fails++;
    j.lastError = (e.shortMessage || e.message || String(e)).slice(0, 300);
    warn(name, "error", `job failed: ${j.lastError}`);
  } finally {
    j.running = false;
  }
}

export function jobStatus() {
  const t = Date.now();
  return [...jobs.values()].map((j) => ({
    name: j.name,
    description: j.description,
    everySeconds: j.everySec,
    runs: j.runs,
    fails: j.fails,
    lastRun: j.lastRun ? new Date(j.lastRun).toISOString() : null,
    lastOk: j.lastOk ? new Date(j.lastOk).toISOString() : null,
    lastError: j.lastError,
    late: j.lastOk ? t - j.lastOk > 3 * j.everySec * 1000 + 60000 : t - startedAt > 3 * j.everySec * 1000 + 60000,
  }));
}

export const recentActions = () => actions.slice(-50).reverse();

// ---------------------------------------------------------------- jobs

// 1. Floor collapses. Agent positions go through the gateway so their rewards reach the user.
register("liquidations", 20, "Collapse floors that are due (agent positions via the gateway)", async () => {
  for (const name of STACKS) {
    const s = stack(name);
    const ids = await s.game.openPositionIds();
    for (const id of ids) {
      let live;
      try {
        live = await s.game.positionValue(id);
      } catch (e) {
        warn("liquidations", "warn", `${name} #${id}: price unavailable (${(e.shortMessage || e.message).slice(0, 80)})`);
        continue;
      }
      if (!live.liquidatable) continue;
      const pos = await s.game.getPosition(id);
      if (pos.owner.toLowerCase() === s.addr.gateway.toLowerCase()) await act("liquidations", `${name} collapse agent #${id}`, s.gateway, "liquidateAndForward", [id]);
      else await act("liquidations", `${name} collapse #${id}`, s.game, "liquidate", [id]);
    }
  }
});

// 2. Hourly funding.
register("funding", HOUR, "Bring funding up to date on each game", async () => {
  for (const name of STACKS) {
    const s = stack(name);
    if ((await s.game.openPositionIds()).length === 0) continue;
    await act("funding", `${name} updateFunding`, s.game, "updateFunding");
  }
});

// 3. Each series' unlock and payout, on time. Unlock runs before voting in the unlock week.
register("series", 120, "Start each series' unlock in its unlock week and pay out right after its end date", async () => {
  const t = await now();
  const sp = shared.splitter;
  const n = Number(await sp.seriesCount());
  for (let id = 0; id < n; id++) {
    const s = await sp.getSeries(id);
    const phase = Number(s.phase);
    const end = Number(s.end);
    const unlockFrom = end - 30 * 86400;
    const epochStart = t - (t % WEEK);
    if (phase === 1) {
      if (t >= unlockFrom) {
        if (t <= epochStart + HOUR + 30) continue; // Mezo only clears votes from one hour into the week
        await act("series", `startUnlock veBTC series ${id}`, sp, "startUnlock", [id]);
        const after = await sp.getSeries(id);
        if (Number(after.phase) === 2 && Number(after.lockEnd) !== end) warn("series", "critical", `series ${id} lock ends ${new Date(Number(after.lockEnd) * 1000).toISOString()} instead of the series end date`);
      } else if (unlockFrom - t < 2 * 86400) {
        warn("series", "info", `series ${id} unlock window opens ${new Date(unlockFrom * 1000).toISOString()}`);
      }
    } else if (phase === 2) {
      const lockEnd = Number(s.lockEnd);
      if (t >= lockEnd + HOUR + 60) {
        await act("series", `mature veBTC series ${id}`, sp, "mature", [id]);
      } else if (t > lockEnd + 3 * HOUR) {
        warn("series", "critical", `series ${id} payout is ${Math.round((t - lockEnd) / 60)} min late`);
      }
    }
  }
  const sv = shared.savings;
  const m = Number(await sv.seriesCount());
  for (let id = 0; id < m; id++) {
    const s = await sv.getSeries(id);
    if (!s.matured && t >= Number(s.end)) await act("series", `mature sMUSD series ${id}`, sv, "mature", [id]);
  }
});

// 4. Weekly voting: each series lock votes for the gauge that paid the most per vote last week.
register("voting", 600, "Vote each series lock for the gauge paying the most fees per vote", async () => {
  const t = await now();
  const epochStart = t - (t % WEEK);
  if (t <= epochStart + HOUR + 60 || t >= epochStart + WEEK - HOUR) return; // Mezo's vote window
  const sp = shared.splitter;
  const best = await bestPool(epochStart);
  const n = Number(await sp.seriesCount());
  for (let id = 0; id < n; id++) {
    const s = await sp.getSeries(id);
    const phase = Number(s.phase);
    if (s.masterId === 0n || phase === 3) continue;
    if (phase === 1 && t >= Number(s.end) - 30 * 86400) continue; // unlock first
    if (Number(await shared.voter.lastVoted(s.masterId)) >= epochStart) continue;
    await act("voting", `vote series ${id} for ${best.pool}`, sp, "vote", [id, [best.pool], [1]]);
  }
});

async function bestPool(epochStart) {
  const musd = addresses.mezo.musd;
  const candidates = [addresses.mezo.smusdGaugePool, addresses.mezo.musdBtcPool];
  let best = { pool: candidates[0], score: -1 };
  for (const pool of candidates) {
    const gauge = await shared.voter.gauges(pool);
    const fees = c(await shared.voter.gaugeToFees(gauge), ABI.reward);
    const paid = await fees.tokenRewardsPerEpoch(musd, epochStart - WEEK);
    const weight = await shared.voter.weights(pool);
    const score = fmt(paid) / (fmt(weight) + 1e-9);
    if (score > best.score) best = { pool, score };
  }
  return best;
}

// 5. Rewards: harvest series rewards for Y holders, sMUSD yield, the Bank's Y; report weekly yield to Pricers.
register("rewards", 6 * HOUR, "Collect series rewards, sMUSD yield and the Bank's Y; report weekly yield", async () => {
  const t = await now();
  const sp = shared.splitter;
  const n = Number(await sp.seriesCount());
  for (let id = 0; id < n; id++) {
    const s = await sp.getSeries(id);
    if (s.masterId !== 0n && Number(s.phase) !== 3) await act("rewards", `harvest veBTC series ${id}`, sp, "harvest", [id]);
    for (const name of STACKS) {
      const st = stack(name);
      const y = c(s.y, ABI.erc20);
      if ((await y.balanceOf(st.addr.bank)) > 0n) await act("rewards", `${name} bank claimY ${id}`, st.bank, "claimY", [id]);
      const p = c(s.p, ABI.erc20);
      if (Number(s.phase) === 3 && (await p.balanceOf(st.addr.bank)) > 0n) await act("rewards", `${name} bank redeemP ${id}`, st.bank, "redeemP", [id]);
    }
  }
  const sv = shared.savings;
  const m = Number(await sv.seriesCount());
  for (let id = 0; id < m; id++) {
    const s = await sv.getSeries(id);
    if (!s.matured && s.principal > 0n) await act("rewards", `harvest sMUSD series ${id}`, sv, "harvest", [id]);
  }
  // Weekly yield for the Pricers: last week's sMUSD gauge fees per unit of vote weight.
  const epoch = Math.floor(t / WEEK);
  if (kv.yieldReportedEpoch !== epoch && t > epoch * WEEK + 2 * HOUR) {
    const gauge = await shared.voter.gauges(addresses.mezo.smusdGaugePool);
    const fees = c(await shared.voter.gaugeToFees(gauge), ABI.reward);
    const paid = await fees.tokenRewardsPerEpoch(addresses.mezo.musd, (epoch - 1) * WEEK);
    const weight = await shared.voter.weights(addresses.mezo.smusdGaugePool);
    if (weight > 0n) {
      const perBTC = (paid * 10n ** 18n) / weight;
      for (const name of STACKS) await act("rewards", `${name} reportWeeklyYield ${fmt(perBTC).toFixed(2)}`, stack(name).pricer, "reportWeeklyYield", [perBTC]);
      kv.yieldReportedEpoch = epoch;
      saveKv();
    }
  }
});

// 6. Climb Premium kill switch at the end of each epoch.
register("killSwitch", 60, "Check the Climb Premium kill switch after each epoch ends", async () => {
  for (const name of STACKS) {
    const s = stack(name);
    const e = Number(await s.game.currentEpoch());
    if (e < 2 || (await s.game.killChecked(e - 1))) continue;
    await act("killSwitch", `${name} checkKillSwitch (epoch ${e - 1})`, s.game, "checkKillSwitch");
  }
});

// 7. Jackpot: commit during each epoch, seal after it ends, reveal within 256 blocks.
register("jackpot", 60, "Jackpot draw: commit, seal tickets, reveal", async () => {
  for (const name of STACKS) {
    const s = stack(name);
    const len = Number(await s.game.epochLength());
    const t = await now();
    const e = Math.floor(t / len);
    secrets[name] ??= {};
    if ((await s.jackpot.commitOf(e)) === ethers.ZeroHash && t < (e + 1) * len - 30) {
      const secret = "0x" + crypto.randomBytes(32).toString("hex");
      secrets[name][e] = secret;
      saveSecrets();
      await act("jackpot", `${name} commit epoch ${e}`, s.jackpot, "commit", [e, ethers.keccak256(secret)]);
    }
    for (const p of [e - 2, e - 1]) {
      if (p < 0 || (await s.jackpot.drawn(p))) continue;
      if ((p + 1) * len < addresses.stacks[name].deployedAt) continue;
      if (!(await s.game.epochSealed(p))) {
        await act("jackpot", `${name} seal epoch ${p}`, s.game, "checkpoint", [p]);
        continue;
      }
      const sb = Number(await s.game.sealBlock(p));
      const block = await provider.getBlockNumber();
      const committed = (await s.jackpot.commitOf(p)) !== ethers.ZeroHash;
      if (!committed || block > sb + 256) {
        await act("jackpot", `${name} skip epoch ${p}`, s.jackpot, "skip", [p]);
      } else if (block > sb + 1) {
        const secret = secrets[name][p];
        if (!secret) {
          warn("jackpot", "warn", `${name} epoch ${p}: secret not found, will skip after the reveal window`);
          continue;
        }
        await act("jackpot", `${name} reveal epoch ${p}`, s.jackpot, "reveal", [p, secret]);
      }
    }
  }
});

// 8. Bank upkeep.
register("bank", 300, "Keep each Bank's loan near its target ratio", async () => {
  for (const name of STACKS) {
    const s = stack(name);
    // Cash reserve: top up MUSD on hand from the trove (never past the target ratio); warn if still short.
    if ((await s.bank.liquidity()) < (await s.bank.reserveTarget())) {
      if (await s.bank.hasTrove()) await act("bank", `${name} topUpReserve`, s.bank, "topUpReserve");
      const left = await s.bank.liquidity();
      const target = await s.bank.reserveTarget();
      if (left < target) warn("bank", "warn", `${name} Bank cash reserve short: ${fmt(left).toFixed(2)} of ${fmt(target).toFixed(2)} MUSD (no trove room within the target ratio)`);
    }
    const idle = await provider.getBalance(s.addr.bank);
    if (!(await s.bank.hasTrove())) {
      const gap0 = await s.game.imbalance();
      const liq0 = await s.bank.liquidity();
      if (gap0 > 0n && liq0 < gap0 / 5n) warn("bank", "warn", `${name} Bank has no Mezo loan and only ${fmt(liq0).toFixed(2)} MUSD on hand for a ${fmt(gap0).toFixed(2)} MUSD gap`);
      if (idle >= ethers.parseEther("0.06")) await act("bank", `${name} rebalance (open)`, s.bank, "rebalance");
      continue;
    }
    // A Bank pays winners from MUSD on hand; warn if a 20% move on the gap it carries could not be paid.
    const gap = await s.game.imbalance();
    const liq = await s.bank.liquidity();
    if (gap > 0n && liq < gap / 5n) warn("bank", "warn", `${name} Bank has ${fmt(liq).toFixed(2)} MUSD on hand for a ${fmt(gap).toFixed(2)} MUSD gap`);
    const cr = await s.bank.collateralRatio();
    if (idle > 0n || cr < (await s.bank.lowerCR()) || cr > (await s.bank.upperCR())) await act("bank", `${name} rebalance`, s.bank, "rebalance");
  }
});

// 9. Juu account safety guards.
register("guards", 60, "Close Juu account bets when a trove nears danger or Mezo nears Recovery Mode", async () => {
  for (const name of STACKS) {
    if (!addresses.stacks[name].accountFactory && !addresses.stacks[name].watchAccounts) continue;
    const accounts = [...byEvent(name, "accountFactory", "AccountCreated").map((e) => e.args.account), ...(addresses.stacks[name].watchAccounts || [])];
    for (const account of [...new Set(accounts)]) {
      const ev = { args: { account } };
      const acct = c(account, ABI.account);
      if ((await acct.openPositions()).length === 0) continue;
      const [trip, reason] = await acct.shouldGuard();
      if (trip) {
        warn("guards", "warn", `${name} account ${ev.args.account}: ${reason}`);
        // One close per call: a close costs millions of gas on Mezo and the block limit is 10 million. guard()
        // catches a failed close, so a fixed gas limit is used instead of an estimate. Repeats each minute.
        await act("guards", `${name} guard ${ev.args.account}`, acct, "guard", [1], { gasLimit: 9500000n });
      }
    }
  }
});

// 10. Price history and event scanning.
register("prices", 60, "Sample each stack's BTC price for the price history", async () => {
  await sample();
});

register("events", 30, "Scan game, gateway, jackpot and account events", async () => {
  for (const name of STACKS) await scan(name);
});

// ---------------------------------------------------------------- scheduler

let startedAt = Date.now();
export function startKeeper({ dryRun = false } = {}) {
  startedAt = Date.now();
  for (const name of STACKS) addresses.stacks[name].deployedAt ??= 0;
  const order = ["events", "prices", "series", "voting", "liquidations", "funding", "rewards", "killSwitch", "jackpot", "bank", "guards"];
  const due = (j) => !j.lastRun || Date.now() - j.lastRun >= j.everySec * 1000;
  setInterval(async () => {
    for (const name of order) {
      const j = jobs.get(name);
      if (j && due(j) && !(dryRun && !["events", "prices"].includes(name))) await runJob(name);
    }
  }, 5000);
}
