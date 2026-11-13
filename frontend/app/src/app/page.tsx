"use client";
import { Agaruzo, FloorBadge, Ladder, amt, collapsePrice, fmt, lev, pad2, shortAddr, signed, usd, type LadderRow } from "@juu/ui";
import { Contract, formatUnits, parseUnits, type Signer } from "ethers";
import { useEffect, useMemo, useRef, useState } from "react";
import { PctButtons } from "@/components/PctButtons";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { stackAddr, usePoll, useRead, useStack } from "@/lib/data";
import { hhmm, seriesShort } from "@/lib/format";
import { useMarket } from "@/lib/market";
import type { BankRes, FeedItem, Pos } from "@/lib/types";
import { call, read, useWallet } from "@/lib/wallet";

type Chip = "MUSD" | "Y" | "P";
const SIDE_NUM = { Bull: 0, Bear: 1 } as const;

function feedLine(e: FeedItem): { m: string; c: string } {
  const who = e.isAgent ? `${shortAddr(e.agent || "")} (agent)` : shortAddr(e.player);
  const fl = e.floor ? pad2(e.floor) : "??";
  switch (e.kind) {
    case "open":
      return { m: `${who} went ${(e.side || "").toLowerCase()} on ${fl}`, c: e.side === "Bear" ? "c-bear" : "c-bull" };
    case "climb":
      return { m: `AGARUZO! ${who} reached floor ${fl}`, c: "c-hi" };
    case "drop":
      return { m: `${who} dropped to floor ${fl}`, c: "c-ink" };
    case "close":
      return { m: `${who} cashed out on ${fl} · ${signed(e.pnl || 0)}`, c: "c-ink" };
    case "collapse":
      return { m: `FLOOR ${fl} ${e.side === "Bear" ? "BEARS" : "BULLS"} DOWN · survivors +${fmt(e.toSurvivors || 0, 2)}`, c: "c-bear" };
    case "jackpot":
      return { m: `JACKPOT ${amt(e.prize || 0)} MUSD to ${who}`, c: "c-hi" };
  }
}

export default function MUSDash() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const m = useMarket();
  const [side, setSide] = useState<"Bull" | "Bear">("Bull");
  const [chip, setChip] = useState<Chip>("MUSD");
  const [amount, setAmount] = useState("");
  const [floor, setFloor] = useState(5);
  const [pick, setPick] = useState<number | null>(null);
  const [cheer, setCheer] = useState<number | null>(null);
  const cheerT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const positions = usePoll<{ positions: Pos[] }>(`/api/${stack}/positions`, 10000, w.bump);
  const bank = usePoll<BankRes>(`/api/${stack}/bank`, 30000, w.bump);
  const tradingFee = useRead(`fee-${stack}`, async () => Number(formatUnits(await read(A.game, ABI.game).tradingFee(), 18)), 300000);
  const loopOn = useRead(w.address ? `loop-${stack}-${w.address}` : null, () => read(A.loop, ABI.loop).isOn(w.address) as Promise<boolean>, 30000, w.bump);

  // Chips: Yield and Principal of the nearest open BTC series.
  const series = useMemo(
    () => (m.series || []).filter((s) => s.kind === "veBTC" && s.phase === "Open").sort((a, b) => a.endDate.localeCompare(b.endDate))[0] || null,
    [m.series],
  );
  const chipLabel = (c: Chip) => (c === "MUSD" ? "MUSD" : `${c === "Y" ? "Yield" : "Principal"} ${series ? seriesShort(series.endDate) : ""}`.trim());
  const unit = chip === "MUSD" ? "MUSD" : chip === "Y" ? "YIELD" : "PRINCIPAL";
  // The wallet's balance of the chip being bet (MUSD, or this series' Yield or Principal), for 25% to MAX.
  const chipToken = chip === "MUSD" ? ADDR.mezo.musd : chip === "Y" ? series?.yToken : series?.pToken;
  const chipBal = useRead(w.address && chipToken ? `chipbal-${chipToken}-${w.address}` : null, async () => Number(formatUnits(await read(chipToken!, ABI.erc20).balanceOf(w.address), 18)), 20000, w.bump);
  const perToken = chip === "MUSD" ? 1 : chip === "Y" ? series?.yMarginValuePerY ?? 0 : series?.pMarginValuePerP ?? 0;

  const n = Number(amount.replace(/,/g, "")) || 0;
  const short = Boolean(w.address) && chipBal != null && n > chipBal;
  const value = n * perToken;
  const exposure = value * lev(floor);
  const mark = m.floors?.price ?? null;
  const premium = floor >= 7 ? m.climb?.floors.find((f) => f.floor === floor)?.nextSeatPremium ?? null : null;
  const premiumText = floor < 7 ? "floors 7 to 10 only" : !m.climb ? "—" : m.climb.premiumOn ? `${fmt(premium ?? 0, 2)} MUSD` : "off";
  const tooBig = bank.data ? exposure > bank.data.largestBetSizeNowMUSD : false;

  const rows: LadderRow[] = (m.floors?.floors || []).map((f) => ({
    floor: f.floor,
    bullPool: f.positions.filter((p) => p.side === "Bull").reduce((s, p) => s + p.size, 0),
    bearPool: f.positions.filter((p) => p.side === "Bear").reduce((s, p) => s + p.size, 0),
  }));

  const mine = (positions.data?.positions || []).filter((p) => w.address && p.player.toLowerCase() === w.address.toLowerCase()).sort((a, b) => b.id - a.id);
  const pos = mine.find((p) => p.id === pick) || mine[0] || null;

  useEffect(() => () => {
    if (cheerT.current) clearTimeout(cheerT.current);
  }, []);
  const agaruzo = (f: number) => {
    setCheer(f);
    if (cheerT.current) clearTimeout(cheerT.current);
    cheerT.current = setTimeout(() => setCheer(null), 1800);
  };

  const game = (s: Signer) => new Contract(A.game, ABI.game, s);
  const approveIfNeeded = (token: string, spender: string, need: bigint) => async (s: Signer) => {
    const t = new Contract(token, ABI.erc20, s);
    const have: bigint = await t.allowance(await s.getAddress(), spender);
    return have >= need ? null : call(t, "approve", [spender, need]);
  };

  const open = async () => {
    if (n <= 0) return;
    const f = floor;
    let steps;
    if (chip === "MUSD") {
      const margin = parseUnits(String(n), 18);
      const size = (margin * BigInt(Math.round(lev(f) * 10))) / 10n;
      const fee = (size * parseUnits(String(tradingFee ?? 0.001), 18)) / 10n ** 18n;
      const prem = premium && m.climb?.premiumOn ? parseUnits(fmt(premium * 1.1, 6).replace(/,/g, ""), 18) : 0n;
      steps = [approveIfNeeded(ADDR.mezo.musd, A.game, margin + fee + prem), (s: Signer) => call(game(s), "open", [SIDE_NUM[side], f, margin])];
    } else {
      if (!series) return;
      const tokens = parseUnits(String(n), 18);
      const token = chip === "Y" ? series.yToken : series.pToken;
      steps = [approveIfNeeded(token, A.game, tokens), (s: Signer) => call(game(s), "openWithTokens", [SIDE_NUM[side], f, chip === "Y" ? 1 : 2, series.id, tokens])];
    }
    if (await w.run("open", steps, `Open on floor ${pad2(f)}.`)) {
      agaruzo(f);
      setPick(null);
    }
  };

  const move = async (to: number) => {
    if (!pos) return;
    if (await w.run("move", [(s) => call(game(s), "moveFloor", [pos.id, to])], `Now on floor ${pad2(to)}.`)) {
      if (to > pos.floor) agaruzo(to);
    }
  };
  const cashOut = () => {
    if (!pos) return;
    w.run("move", [(s) => (pos.isAgent ? call(new Contract(A.gateway, ABI.gateway, s), "userClose", [pos.id]) : call(game(s), "close", [pos.id]))], "Cashed out.");
  };
  const toggleLoop = () => {
    if (!series) return;
    w.run("loop", [(s) => call(new Contract(A.loop, ABI.loop, s), "setLoop", [!loopOn, series.id])], loopOn ? "Loop off." : "Loop on.");
  };

  const pnl = pos ? (pos.pnl ?? 0) - (pos.funding ?? 0) + (pos.earned ?? 0) : 0;
  const posUnit = pos ? (pos.chip === "MUSD" ? "MUSD" : "MUSD of " + (pos.chip === "Y" ? "Yield" : "Principal")) : "";

  return (
    <div className="dash">
      <section aria-label="The tower" className="tower">
        <div className="title-row">
          <h1 className="h1">MUSDASH · THE LADDER</h1>
          {cheer != null && <Agaruzo floor={cheer} />}
        </div>
        <Ladder mark={mark} change={m.change} rows={rows} selected={floor} onPick={setFloor} />
        <div className="ladder-caption">ORDER-BOOK VIEW · EACH FLOOR IS A PRICE LADDER RUNG · SHADE = POOL DEPTH</div>
        <section aria-label="Live" className="live">
          <div className="label">LIVE</div>
          {m.feed && m.feed.length === 0 && <div className="empty">No moves yet on this stack.</div>}
          {!m.feed && <div className="empty">Loading the live feed…</div>}
          {(m.feed || []).slice(0, 6).map((e) => {
            const l = feedLine(e);
            return (
              <div className="live-row" key={e.tx + e.kind + (e.id ?? "")}>
                <span className="t">{hhmm(e.time)}</span>
                <span className={l.c}>{l.m}</span>
              </div>
            );
          })}
        </section>
      </section>

      <aside className="aside">
        <section aria-label="Place a position" className="slip">
          <div className="sides">
            <button type="button" className="side-btn bull" aria-pressed={side === "Bull"} onClick={() => setSide("Bull")}>▲ BULL</button>
            <button type="button" className="side-btn bear" aria-pressed={side === "Bear"} onClick={() => setSide("Bear")}>BEAR ▼</button>
          </div>
          <div className="label mt16">CHIPS</div>
          <div className="chips">
            {(["MUSD", "Y", "P"] as Chip[]).map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={chip === c} onClick={() => setChip(c)} disabled={c !== "MUSD" && !series} title={chipLabel(c)}>
                {chipLabel(c)}
              </button>
            ))}
          </div>
          <label htmlFor="amt" className="label mt16" style={{ display: "block" }}>AMOUNT</label>
          <div className="amount-row">
            <input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" />
            <span className="unit">{unit}</span>
          </div>
          <PctButtons balance={chipBal} decimals={chip === "MUSD" ? 2 : 6} onPick={setAmount} label={unit.toLowerCase()} />
          <div className="label mt16">FLOOR</div>
          <div className="picks">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((f) => (
              <button key={f} type="button" className="pick" aria-pressed={floor === f} onClick={() => setFloor(f)}>{f}</button>
            ))}
          </div>
          <dl className="readout">
            <dt>Leverage</dt><dd>{lev(floor)}×</dd>
            <dt>Exposure</dt><dd>{fmt(exposure)} MUSD</dd>
            <dt>Collapses at</dt><dd className="c-bear">{mark == null ? "—" : usd(collapsePrice(mark, floor, side))}</dd>
            <dt>Fee</dt><dd>{tradingFee == null ? "—" : fmt(exposure * tradingFee, 2) + " MUSD"}</dd>
            <dt>Climb premium</dt><dd className="c-muted">{premiumText}</dd>
          </dl>
          {tooBig && <p className="txnote error">The Bank can cover up to {fmt(bank.data!.largestBetSizeNowMUSD)} MUSD of exposure right now. Try a smaller amount.</p>}
          <button type="button" className="btn-strong open-btn" onClick={open} disabled={busy(w.tx, "open") || n <= 0 || short}>
            {busy(w.tx, "open") ? "OPENING…" : n <= 0 ? "ENTER AN AMOUNT" : short ? `NOT ENOUGH ${chip === "MUSD" ? "MUSD" : unit}` : `OPEN ON FLOOR ${floor}`}
          </button>
          <TxNote k="open" />
        </section>

        <section aria-label="Your position" className="yours">
          <FloorBadge floor={pos ? pos.floor : null} />
          <div className="info">
            {!pos ? (
              <>
                <div className="l1"><span className="mono" style={{ fontSize: 14 }}>NO OPEN POSITION</span></div>
                <div className="l2">{w.address ? "Pick a side and a floor, then open." : "Connect a wallet to see your position."}</div>
              </>
            ) : (
              <>
                <div className="l1">
                  <span className={"mono " + (pos.side === "Bull" ? "c-bull" : "c-bear")} style={{ fontSize: 14 }}>
                    {pos.side === "Bull" ? `▲ BULL · ${lev(pos.floor)}×` : `BEAR ▼ · ${lev(pos.floor)}×`}
                  </span>
                  <span className={"mono " + (pnl >= 0 ? "c-bull" : "c-bear")} style={{ fontSize: 18 }}>{signed(pnl)}</span>
                </div>
                <div className="l2">
                  {amt(pos.chipValue ?? 0)} {posUnit} · collapses at {pos.collapsePrice ? usd(pos.collapsePrice) : "—"}
                  {pos.isAgent && " · played by your agent"}
                </div>
                <div className="acts">
                  <button type="button" onClick={() => move(pos.floor - 1)} disabled={pos.isAgent || pos.floor <= 1 || busy(w.tx, "move")}>↓ DROP</button>
                  <button type="button" className="climb" onClick={() => move(pos.floor + 1)} disabled={pos.isAgent || pos.floor >= 10 || busy(w.tx, "move")}>↑ CLIMB</button>
                  <button type="button" onClick={cashOut} disabled={busy(w.tx, "move")}>CASH OUT</button>
                </div>
                {mine.length > 1 && (
                  <div className="pos-switch" aria-label="Your open positions">
                    {mine.map((p) => (
                      <button key={p.id} type="button" aria-pressed={p.id === pos.id} onClick={() => setPick(p.id)}>
                        #{p.id} · {p.side === "Bull" ? "▲" : "▼"} {pad2(p.floor)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {w.address && (
              <label className="check">
                <input type="checkbox" checked={Boolean(loopOn)} onChange={toggleLoop} disabled={!series || busy(w.tx, "loop")} />
                Loop winnings into my BTC lock
              </label>
            )}
            <TxNote k={["move", "loop"]} wallet={false} />
          </div>
        </section>
      </aside>
    </div>
  );
}
