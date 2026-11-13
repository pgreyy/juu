"use client";
import { amt, lev, pad2, signed, usd } from "@juu/ui";
import { Contract } from "ethers";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { useSeriesBalances } from "@/lib/balances";
import { stackAddr, usePoll, useRead, useStack } from "@/lib/data";
import { btc, daysLeft, seriesName } from "@/lib/format";
import { useMarket } from "@/lib/market";
import type { Pos } from "@/lib/types";
import { call, read, useWallet } from "@/lib/wallet";

export default function Positions() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const m = useMarket();
  const series = (m.series || []).slice().sort((a, b) => a.endDate.localeCompare(b.endDate) || a.kind.localeCompare(b.kind));
  const bals = useSeriesBalances(w.address, m.series ? series : null, w.bump);
  const positions = usePoll<{ positions: Pos[] }>(`/api/${stack}/positions`, 15000, w.bump);
  const loopOn = useRead(w.address ? `loop-${stack}-${w.address}` : null, () => read(A.loop, ABI.loop).isOn(w.address) as Promise<boolean>, 30000, w.bump);
  const open = series.find((s) => s.kind === "veBTC" && s.phase === "Open");

  const rows = (bals || []).filter((b) => b.s.kind === "veBTC" || b.p > 0 || b.y > 0);
  const total = (bals || []).filter((b) => b.s.kind === "veBTC").reduce((s, b) => s + b.p, 0);
  const mine = (positions.data?.positions || []).filter((p) => w.address && p.player.toLowerCase() === w.address.toLowerCase()).sort((a, b) => b.id - a.id);

  const earnedText = (e: { sym: string; v: number }[]) => {
    const nz = e.filter((x) => x.v > 0);
    return nz.length ? nz.map((x) => `${x.sym === "BTC" ? btc(x.v) : amt(x.v)} ${x.sym}`).join(" · ") : "0.0000";
  };
  const toggleLoop = () => open && w.run("loop", [(s) => call(new Contract(A.loop, ABI.loop, s), "setLoop", [!loopOn, open.id])], loopOn ? "Loop off." : "Loop on.");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div className="label">TOTAL IN JUU</div>
          <div className="big-num">{w.address ? (bals ? btc(total) : "…") : "—"} <span className="u">BTC</span></div>
        </div>
        {w.address && (
          <label className="check" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={Boolean(loopOn)} onChange={toggleLoop} disabled={!open || busy(w.tx, "loop")} />
            Loop winnings into my BTC lock
          </label>
        )}
      </div>
      <TxNote k="loop" />
      <div className="tbl-wrap" style={{ marginTop: 24 }}>
        <table className="tbl" style={{ minWidth: 620 }}>
          <thead>
            <tr><th>SERIES</th><th>PRINCIPAL · BTC BACK</th><th>YIELD</th><th>EARNED</th><th>ENDS</th></tr>
          </thead>
          <tbody>
            {!w.address && (
              <tr><td colSpan={5} className="c-muted" style={{ padding: "16px 0" }}>Connect a wallet to see your Principal and Yield.</td></tr>
            )}
            {rows.map((b) => (
              <tr key={b.s.kind + b.s.id}>
                <td style={{ padding: "16px 0", fontWeight: 600 }}>{seriesName(b.s.endDate)}{b.s.kind === "sMUSD" ? " · sMUSD" : ""}</td>
                <td>{b.s.kind === "veBTC" ? btc(b.p) : `${amt(b.p)} MUSD`}</td>
                <td>{b.s.kind === "veBTC" ? btc(b.y) : amt(b.y)}</td>
                <td className="c-bull">{earnedText(b.earned)}</td>
                <td className="c-muted">{daysLeft(b.s.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Principal is your Bitcoin back on the end date. Your BTC stays in Juu until then. Yield is what it earns until that day.</p>
      <div className="label" style={{ marginTop: 28 }}>OPEN BETS</div>
      {w.address && positions.data && mine.length === 0 && <div className="empty">No open bets. Open one on MUSDash.</div>}
      {!w.address && <div className="empty">Connect a wallet to see your bets.</div>}
      <div className="bets">
        {mine.map((p) => {
          const pnl = (p.pnl ?? 0) - (p.funding ?? 0) + (p.earned ?? 0);
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
    </>
  );
}
