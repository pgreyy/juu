"use client";
import { amt, fmt, lev, pad2, shortAddr, signed, usd } from "@juu/ui";
import { Contract, ZeroAddress, formatUnits } from "ethers";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { useBtcBalance, useSeriesBalances } from "@/lib/balances";
import { stackAddr, usePoll, useRead, useStack } from "@/lib/data";
import { btc, daysLeft, seriesName } from "@/lib/format";
import { useMarket } from "@/lib/market";
import type { Pos } from "@/lib/types";
import { EXPLORER, call, read, useWallet } from "@/lib/wallet";

type Activity = {
  kind: "open" | "climb" | "drop" | "cashout" | "collapse" | "deposit" | "withdraw" | "jackpot";
  id?: number; agent?: string | null; side?: "Bull" | "Bear" | null; floor?: number | null; fromFloor?: number; chip?: string;
  sizeMUSD?: number; musdOut?: number; resultMUSD?: number; btc?: number; prizeMUSD?: number; time: string; tx: string;
};
type PortfolioRes = { realizedTodayMUSD: number; activity: Activity[] };
type Tickets = { yourTickets: number; allTickets: number; yourOdds: number };
type Line = { what: string; detail: string; amount: string; usd: number; note?: string };

const n18 = (x: bigint) => Number(formatUnits(x, 18));
// Small BTC amounts need more than btc()'s 4 decimals.
const b8 = (x: number) => (x > 0 && x < 0.01 ? fmt(x, 8) : btc(x));
const when = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" }).toUpperCase()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

function activityLine(a: Activity): { text: string; tone: string } {
  const side = a.side === "Bull" ? "▲ Bull" : a.side === "Bear" ? "Bear ▼" : "";
  const by = a.agent ? ` · by agent ${shortAddr(a.agent)}` : "";
  const res = a.resultMUSD == null ? "" : ` · ${signed(a.resultMUSD)} MUSD`;
  const tone = (v?: number) => (v == null ? "c-ink" : v >= 0 ? "c-bull" : "c-bear");
  switch (a.kind) {
    case "open": return { text: `Opened ${side} on floor ${pad2(a.floor ?? 0)} · ${amt(a.sizeMUSD ?? 0)} MUSD size${by}`, tone: a.side === "Bear" ? "c-bear" : "c-bull" };
    case "climb": return { text: `Climbed ${pad2(a.fromFloor ?? 0)} → ${pad2(a.floor ?? 0)}${by}`, tone: "c-ink" };
    case "drop": return { text: `Dropped ${pad2(a.fromFloor ?? 0)} → ${pad2(a.floor ?? 0)}${by}`, tone: "c-ink" };
    case "cashout": return { text: `Cashed out ${side} on floor ${pad2(a.floor ?? 0)}${res}${by}`, tone: tone(a.resultMUSD) };
    case "collapse": return { text: `Floor ${pad2(a.floor ?? 0)} collapsed under your ${side}${res}${by}`, tone: "c-bear" };
    case "deposit": return { text: `Deposited ${btc(a.btc ?? 0)} BTC into the Bank`, tone: "c-ink" };
    case "withdraw": return { text: `Withdrew ${btc(a.btc ?? 0)} BTC from the Bank`, tone: "c-ink" };
    case "jackpot": return { text: `Won the jackpot · ${amt(a.prizeMUSD ?? 0)} MUSD`, tone: "c-hi" };
  }
}

export default function Portfolio() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const m = useMarket();
  const me = w.address;
  const price = m.floors?.price ?? 0; // USD per BTC (the stack's mark)
  const series = (m.series || []).slice().sort((a, b) => a.endDate.localeCompare(b.endDate) || a.kind.localeCompare(b.kind));
  const bals = useSeriesBalances(me, m.series ? series : null, w.bump);
  const positions = usePoll<{ positions: Pos[] }>(`/api/${stack}/positions`, 15000, w.bump);
  const port = usePoll<PortfolioRes>(me ? `/api/${stack}/portfolio/${me}` : null, 30000, w.bump);
  const tickets = usePoll<Tickets>(me ? `/api/${stack}/tickets/${me}` : null, 60000, w.bump);
  const loopOn = useRead(me ? `loop-${stack}-${me}` : null, () => read(A.loop, ABI.loop).isOn(me) as Promise<boolean>, 30000, w.bump);
  const walletBtc = useBtcBalance(me, w.bump);
  const walletMusd = useRead(me ? `musd-${me}` : null, async () => n18(await read(ADDR.mezo.musd, ABI.erc20).balanceOf(me)), 20000, w.bump);
  const bank = useRead(me ? `bankshare-${stack}-${me}` : null, async () => {
    const b = read(A.bank, ABI.bank);
    const [assets, supply, mine] = (await Promise.all([b.totalAssetsBTC(), b.totalSupply(), b.balanceOf(me)])) as bigint[];
    return supply > 0n ? n18((mine * assets) / supply) : 0;
  }, 30000, w.bump);
  // The Juu account (main stack only): its trove and the MUSD it holds.
  const account = useRead(me && A.accountFactory ? `acct-${me}` : null, async () => {
    const acc: string = await read(A.accountFactory!, ABI.factory).accountOf(me);
    if (acc === ZeroAddress) return null;
    const tm = read(ADDR.mezo.troveManager, ABI.troveManager);
    const [musd, own, coll, debt] = await Promise.all([
      read(ADDR.mezo.musd, ABI.erc20).balanceOf(acc), read(ADDR.mezo.btc, ABI.erc20).balanceOf(acc),
      tm.getTroveColl(acc).catch(() => 0n), tm.getTroveDebt(acc).catch(() => 0n),
    ]);
    return { address: acc, musd: n18(musd), btc: n18(own), coll: n18(coll), debt: n18(debt) };
  }, 30000, w.bump);

  const open = series.find((s) => s.kind === "veBTC" && s.phase === "Open");
  const allMine = (positions.data?.positions || []).filter((p) => me && p.player.toLowerCase() === me.toLowerCase()).sort((a, b) => b.id - a.id);
  const ownBets = allMine.filter((p) => !p.isAgent);
  const agentBets = allMine.filter((p) => p.isAgent);
  const live = (p: Pos) => (p.pnl ?? 0) - (p.funding ?? 0) + (p.earned ?? 0);

  // Every holding, valued in USD (1 MUSD = $1, BTC at the mark). Principal and Yield use the Pricer's values, the same
  // ones MUSDash uses for chips. MEZO rewards have no price here, so they are listed but not counted.
  const lines: Line[] = [];
  if (me) {
    lines.push({ what: "Wallet", detail: "BTC", amount: `${b8(walletBtc ?? 0)} BTC`, usd: (walletBtc ?? 0) * price });
    lines.push({ what: "Wallet", detail: "MUSD", amount: `${amt(walletMusd ?? 0)} MUSD`, usd: walletMusd ?? 0 });
    for (const b of bals || []) {
      const name = `${seriesName(b.s.endDate)}${b.s.kind === "sMUSD" ? " · sMUSD" : ""} · ${daysLeft(b.s.endDate)}`;
      const ve = b.s.kind === "veBTC";
      if (b.p > 0) lines.push({ what: "Principal", detail: name, amount: ve ? `${b8(b.p)} P` : `${amt(b.p)} P`, usd: ve ? b.p * (b.s.pMarginValuePerP ?? 0) : b.p });
      if (b.y > 0) lines.push({ what: "Yield", detail: name, amount: ve ? `${b8(b.y)} Y` : `${amt(b.y)} Y`, usd: ve ? b.y * (b.s.yMarginValuePerY ?? 0) : 0, note: ve ? undefined : "valued by what it has earned" });
      for (const e of b.earned.filter((x) => x.v > 0)) {
        const v = e.sym === "BTC" ? e.v * price : e.sym === "MUSD" ? e.v : 0;
        lines.push({ what: "Earned, to claim", detail: name, amount: `${e.sym === "BTC" ? b8(e.v) : amt(e.v)} ${e.sym}`, usd: v, note: e.sym === "MEZO" ? "not counted: no MEZO price here" : undefined });
      }
    }
    lines.push({ what: "Bank", detail: `your share (${stack} stack)`, amount: `${b8(bank ?? 0)} BTC`, usd: (bank ?? 0) * price });
    lines.push({ what: "MUSDash", detail: `${ownBets.length} open bet${ownBets.length === 1 ? "" : "s"}`, amount: `${amt(ownBets.reduce((s, p) => s + (p.equity ?? 0), 0))} MUSD`, usd: ownBets.reduce((s, p) => s + (p.equity ?? 0), 0) });
    lines.push({ what: "Your agents", detail: `${agentBets.length} open bet${agentBets.length === 1 ? "" : "s"} with your MUSD`, amount: `${amt(agentBets.reduce((s, p) => s + (p.equity ?? 0), 0))} MUSD`, usd: agentBets.reduce((s, p) => s + (p.equity ?? 0), 0) });
    if (account) {
      const net = (account.btc + account.coll) * price + account.musd - account.debt;
      lines.push({ what: "Juu account", detail: `${b8(account.coll)} BTC in its trove · ${amt(account.debt)} MUSD owed · ${amt(account.musd)} MUSD held`, amount: `${amt(net)} USD net`, usd: net });
    }
  }
  const totalUsd = lines.reduce((s, l) => s + l.usd, 0);
  const totalBtc = price > 0 ? totalUsd / price : 0;
  const liveNow = allMine.reduce((s, p) => s + live(p), 0);
  const today = (port.data?.realizedTodayMUSD ?? 0) + liveNow;
  const loaded = Boolean(me && bals && walletBtc != null && walletMusd != null && bank != null && positions.data);

  const toggleLoop = () => open && w.run("loop", [(s) => call(new Contract(A.loop, ABI.loop, s), "setLoop", [!loopOn, open.id])], loopOn ? "Loop off." : "Loop on.");

  return (
    <>
      <h1 className="h1">PORTFOLIO</h1>
      <p className="lede">Everything this wallet holds in Juu, valued at today&apos;s BTC price.</p>
      {!me ? (
        <div className="empty" style={{ fontSize: 14 }}>Connect a wallet to see your portfolio.</div>
      ) : (
        <>
          <div className="stats" style={{ marginTop: 8 }}>
            <div className="stat">
              <div className="k">TOTAL VALUE</div>
              <div className="v">{loaded ? b8(totalBtc) : "…"} BTC</div>
            </div>
            <div className="stat">
              <div className="k">IN USD</div>
              <div className="v">{loaded ? usd(totalUsd) : "…"}</div>
            </div>
            <div className="stat">
              <div className="k">{today > 0.005 ? "▲ PROFIT TODAY" : today < -0.005 ? "▼ LOSS TODAY" : "TODAY"}</div>
              <div className={"v " + (today > 0.005 ? "c-bull" : today < -0.005 ? "c-bear" : "")}>{signed(today)} MUSD</div>
            </div>
            <div className="stat">
              <div className="k">JACKPOT TICKETS</div>
              <div className="v">{fmt(tickets.data?.yourTickets ?? 0)} <span className="c-muted" style={{ fontSize: 14 }}>· {fmt((tickets.data?.yourOdds ?? 0) * 100, 1)}% odds</span></div>
            </div>
          </div>
          <p className="note">Today = bets closed or collapsed since 00:00 UTC, plus the live result of your open bets.</p>

          <div className="label" style={{ marginTop: 28 }}>BREAKDOWN</div>
          <div className="tbl-wrap" style={{ marginTop: 8 }}>
            <table className="tbl pf-tbl">
              <thead>
                <tr><th>HOLDING</th><th className="pf-detail" style={{ textAlign: "left" }}>DETAIL</th><th>AMOUNT</th><th>VALUE (USD)</th></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: "14px 0", fontWeight: 600 }}>
                      {l.what}
                      <span className="pf-sub c-muted">{l.detail}{l.note ? ` · ${l.note}` : ""}</span>
                    </td>
                    <td style={{ textAlign: "left" }} className="pf-detail c-muted">{l.detail}{l.note ? ` · ${l.note}` : ""}</td>
                    <td>{l.amount}</td>
                    <td>{usd(l.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Principal and Yield are valued by Juu&apos;s Pricer, the same values MUSDash uses for chips. Principal pays one BTC each on its end date.</p>
        </>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 28 }}>
        <div className="label">OPEN BETS</div>
        {me && (
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={Boolean(loopOn)} onChange={toggleLoop} disabled={!open || busy(w.tx, "loop")} />
            Loop winnings into my BTC lock
          </label>
        )}
      </div>
      <TxNote k="loop" />
      {me && positions.data && allMine.length === 0 && <div className="empty">No open bets. Open one on MUSDash.</div>}
      {!me && <div className="empty">Connect a wallet to see your bets.</div>}
      <div className="bets">
        {allMine.map((p) => {
          const pnl = live(p);
          const chip = p.chip === "MUSD" ? "MUSD" : p.chip === "Y" ? "YIELD CHIPS" : "PRINCIPAL CHIPS";
          return (
            <div className="bet" key={p.id}>
              <div className={"fb " + (p.side === "Bull" ? "bull" : "bear")}>{pad2(p.floor)}</div>
              <div style={{ flex: 1, fontFamily: "var(--fN)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span className={p.side === "Bull" ? "c-bull" : "c-bear"}>{p.side === "Bull" ? "▲ BULL" : "BEAR ▼"} · {chip}</span>
                  <span className={pnl >= 0 ? "c-bull" : "c-bear"}>{signed(pnl)}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }} className="c-muted">
                  {amt(p.chipValue ?? 0)} MUSD · {lev(p.floor)}× · collapses at {p.collapsePrice ? usd(p.collapsePrice) : "—"}
                  {p.isAgent ? " · agent" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section aria-label="Recent activity" className="live" style={{ marginTop: 40 }}>
        <div className="label">RECENT ACTIVITY</div>
        {!me && <div className="empty">Connect a wallet to see your activity.</div>}
        {me && !port.data && <div className="empty">Loading your activity…</div>}
        {me && port.data && port.data.activity.length === 0 && <div className="empty">No activity yet on the {stack} stack.</div>}
        {(port.data?.activity || []).map((a) => {
          const l = activityLine(a);
          return (
            <div className="live-row" key={a.tx + a.kind + (a.id ?? "")}>
              <span className="t" style={{ flex: "0 0 96px" }}>{when(a.time)}</span>
              <a className={l.tone} href={`${EXPLORER}/tx/${a.tx}`} target="_blank" rel="noreferrer">{l.text}</a>
            </div>
          );
        })}
      </section>
    </>
  );
}
