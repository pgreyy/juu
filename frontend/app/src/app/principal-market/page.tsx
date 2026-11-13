"use client";
import { fmt } from "@juu/ui";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useEffect, useState } from "react";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { useRead } from "@/lib/data";
import { btc, daysLeft, seriesName } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { call, read, useWallet } from "@/lib/wallet";

const pct = (x: number) => fmt(x * 100, 2) + "%";

export default function PrincipalMarket() {
  const w = useWallet();
  const m = useMarket();
  const rows = (m.series || []).filter((s) => s.kind === "veBTC" && s.pMarket && s.phase !== "Matured").sort((a, b) => a.endDate.localeCompare(b.endDate));
  const [sel, setSel] = useState<number | null>(null);
  const pick = rows.find((s) => s.id === sel) || rows.find((s) => s.phase === "Open") || rows[0] || null;
  const [pay, setPay] = useState("");
  useEffect(() => {
    if (pick?.pMarket) setPay(fmt(pick.pMarket.btcPerP * 0.01, 6));
  }, [pick?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Number(pay.replace(/,/g, "")) || 0;
  const quote = useRead(pick && n > 0 ? `quote-${pick.id}-${n}` : null, async () => Number(formatUnits(await read(ADDR.shared.pmarket, ABI.pmarket).quoteBuy(pick!.id, parseUnits(String(n), 18)), 18)), 15000);
  const disc = pick?.pMarket ? 1 - pick.pMarket.btcPerP : 0;

  const buy = () => {
    if (!pick || n <= 0 || !quote) return;
    const minOut = parseUnits(fmt(quote * 0.99, 12).replace(/,/g, ""), 18);
    w.run("buy", [(s) => call(new Contract(ADDR.shared.pmarket, ABI.pmarket, s), "buyP", [pick.id, minOut], { value: parseUnits(String(n), 18) })], `Bought Principal · ${seriesName(pick.endDate)}.`);
  };

  return (
    <>
      <h1 className="h1">PRINCIPAL MARKET</h1>
      <p className="lede">Buy bitcoin below full price. Get the full bitcoin on the end date. No game.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
        <section style={{ flex: "999 1 540px", minWidth: 0 }} className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 540 }}>
            <thead>
              <tr><th>SERIES</th><th>PRICE</th><th>DISCOUNT</th><th>FIXED RETURN</th><th><span className="sr-only">Select</span></th></tr>
            </thead>
            <tbody>
              {!m.series && <tr><td colSpan={5} className="c-muted" style={{ padding: "16px 0" }}>Loading prices…</td></tr>}
              {m.series && rows.length === 0 && <tr><td colSpan={5} className="c-muted" style={{ padding: "16px 0" }}>No Principal Market pools yet.</td></tr>}
              {rows.map((s) => {
                const on = pick?.id === s.id;
                return (
                  <tr key={s.id} style={{ background: on ? "var(--sel)" : "transparent" }}>
                    <td style={{ padding: "16px 8px 16px 0" }}>
                      <div style={{ fontWeight: 600 }}>Principal · {seriesName(s.endDate)}</div>
                      <div className="c-muted" style={{ fontSize: 11 }}>{daysLeft(s.endDate)}{s.phase === "Unlocking" ? " · unlocking" : ""}</div>
                    </td>
                    <td>{fmt(s.pMarket!.btcPerP, 4)}</td>
                    <td>{pct(1 - s.pMarket!.btcPerP)}</td>
                    <td className="c-bull">{pct(s.pMarket!.fixedReturnToEnd)}</td>
                    <td style={{ paddingLeft: 12 }}>
                      <button type="button" className={"btn-line" + (on ? " btn-on" : "")} style={{ minHeight: 40, padding: "0 12px" }} onClick={() => setSel(s.id)}>{on ? "SELECTED" : "SELECT"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">Prices come from each series' pool on Mezo's DEX. Price is BTC per Principal; each Principal pays 1 BTC on its end date.</p>
        </section>
        <section className="panel" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>BUY PRINCIPAL · {pick ? seriesName(pick.endDate) : "—"}</div>
          <div style={{ fontSize: 46, marginTop: 10 }}>{pick?.pMarket ? pct(pick.pMarket.fixedReturnToEnd) : "—"}</div>
          <div style={{ fontFamily: "var(--fB)", fontSize: 13 }}>fixed return if you hold to the end date</div>
          <label htmlFor="mkAmt" style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", marginTop: 18 }}>PAY (BTC)</label>
          <input id="mkAmt" className="line" style={{ fontSize: 28, padding: "6px 0" }} value={pay} onChange={(e) => setPay(e.target.value)} inputMode="decimal" autoComplete="off" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, fontSize: 13 }}>
            <span>You get</span>
            <span>{quote == null ? "—" : `${btc(quote)} Principal → ${btc(quote)} BTC`}</span>
          </div>
          <button type="button" className="btn-strong" style={{ marginTop: 20, height: 54, fontSize: 15 }} onClick={buy} disabled={!pick || !quote || busy(w.tx, "buy")}>
            {busy(w.tx, "buy") ? "BUYING…" : `BUY AT ${pct(disc)} OFF`}
          </button>
          <TxNote k="buy" />
        </section>
      </div>
    </>
  );
}
