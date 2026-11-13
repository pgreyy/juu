"use client";
import { fmt } from "@juu/ui";
import { Contract, formatUnits, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { BTC_GAS_RESERVE, PctButtons } from "@/components/PctButtons";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { useBtcBalance } from "@/lib/balances";
import { useRead } from "@/lib/data";
import { btc, daysLeft, seriesName } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { POOL_ABI } from "@/lib/swap";
import { call, read, useWallet } from "@/lib/wallet";

const pct = (x: number) => fmt(x * 100, 2) + "%";
// Small amounts need more than btc()'s 4 decimals.
const small = (x: number) => (x > 0 && x < 0.01 ? fmt(x, 8) : btc(x));

export default function PrincipalMarket() {
  const w = useWallet();
  const m = useMarket();
  const rows = (m.series || []).filter((s) => s.kind === "veBTC" && s.pMarket && s.phase !== "Matured").sort((a, b) => a.endDate.localeCompare(b.endDate));
  const [sel, setSel] = useState<number | null>(null);
  const pick = rows.find((s) => s.id === sel) || rows.find((s) => s.phase === "Open") || rows[0] || null;
  // Starts empty; 25% to MAX fill it from the wallet.
  const [pay, setPay] = useState("");

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const isBuy = mode === "buy";
  const n = Number(pay.replace(/,/g, "")) || 0;
  const quote = useRead(pick && n > 0 ? `quote-${mode}-${pick.id}-${n}` : null, async () => {
    if (isBuy) return Number(formatUnits(await read(ADDR.shared.pmarket, ABI.pmarket).quoteBuy(pick!.id, parseUnits(String(n), 18)), 18));
    const route = [{ from: pick!.pToken, to: ADDR.mezo.btc, stable: false, factory: ADDR.mezo.poolFactory }];
    const out: bigint[] = await read(ADDR.mezo.router, ABI.router).getAmountsOut(parseUnits(String(n), 18), route);
    return Number(formatUnits(out[1], 18));
  }, 15000);
  const held = useRead(pick && w.address ? `p-${pick.id}-${w.address}` : null, async () => Number(formatUnits(await read(pick!.pToken, ABI.erc20).balanceOf(w.address), 18)), 20000, w.bump);
  const myBtc = useBtcBalance(w.address, w.bump);
  const tooMuch = isBuy ? myBtc != null && n > 0 && n > myBtc - BTC_GAS_RESERVE : held != null && n > held;
  // Price impact: how far this order's average price is from the pool's price now. The pools are small, so a big
  // order moves the price a lot; above 5% the button stays off.
  const spot = pick?.pMarket?.btcPerP ?? 0;
  const avg = quote && n > 0 ? (isBuy ? n / quote : quote / n) : null; // BTC per Principal for this order
  const impact = avg && spot > 0 ? (isBuy ? avg / spot - 1 : 1 - avg / spot) : null;
  const tooBig = impact != null && impact > 0.05;
  // The largest order under the 5% limit, from the pool's reserves (r = the reserve of what you pay in). For a
  // constant-product pool an order of a·r moves the price by about a (plus the 0.04% fee); measured in BTC per
  // Principal a buy reads a little higher, so 4.5% of the reserve keeps both under 5%.
  const reserves = useRead(pick?.pMarket?.pool ? `pmres-${pick.pMarket.pool}` : null, async () => {
    const p = read(pick!.pMarket!.pool, POOL_ABI);
    const [t0, r] = await Promise.all([p.token0(), p.getReserves()]);
    const pIs0 = t0.toLowerCase() === pick!.pToken.toLowerCase();
    return { p: Number(formatUnits(pIs0 ? r[0] : r[1], 18)), btc: Number(formatUnits(pIs0 ? r[1] : r[0], 18)) };
  }, 30000, w.bump);
  const largest = reserves ? 0.045 * (isBuy ? reserves.btc : reserves.p) : null;
  // The fixed return to the end date: for this order when an amount is entered (its own price), else at the pool price.
  const orderReturn = isBuy && quote && n > 0 && !tooBig ? quote / n - 1 : pick?.pMarket?.fixedReturnToEnd ?? 0;

  const go = () => {
    if (!pick || n <= 0 || !quote) return;
    const minOut = parseUnits(fmt(quote * 0.99, 12).replace(/,/g, ""), 18);
    const v = parseUnits(String(n), 18);
    const pm = (s: Signer) => new Contract(ADDR.shared.pmarket, ABI.pmarket, s);
    if (isBuy) {
      w.run("buy", [(s) => call(pm(s), "buyP", [pick.id, minOut], { value: v })], `Bought Principal · ${seriesName(pick.endDate)}.`);
    } else {
      w.run(
        "buy",
        [
          async (s) => {
            const t = new Contract(pick.pToken, ABI.erc20, s);
            return (await t.allowance(await s.getAddress(), ADDR.shared.pmarket)) >= v ? null : call(t, "approve", [ADDR.shared.pmarket, v]);
          },
          (s) => call(pm(s), "sellP", [pick.id, v, minOut]),
        ],
        `Sold Principal · ${seriesName(pick.endDate)}. Paid out in BTC.`,
      );
    }
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
            <button type="button" className="btn-line" style={{ height: 48, fontSize: 13 }} aria-pressed={isBuy} onClick={() => { setMode("buy"); setPay(""); }}>BUY</button>
            <button type="button" className="btn-line" style={{ height: 48, fontSize: 13 }} aria-pressed={!isBuy} onClick={() => { setMode("sell"); setPay(""); }}>SELL</button>
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>{isBuy ? "BUY" : "SELL"} PRINCIPAL · {pick ? seriesName(pick.endDate) : "—"}</div>
          {isBuy ? (
            <>
              <div style={{ fontSize: 46, marginTop: 10 }}>{pct(orderReturn)}</div>
              <div style={{ fontFamily: "var(--fB)", fontSize: 13 }}>fixed return if you hold to the end date</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 46, marginTop: 10 }}>{w.address && held == null ? "…" : held ? small(held) : "0"}</div>
              <div style={{ fontFamily: "var(--fB)", fontSize: 13 }}>Principal you hold in this series</div>
            </>
          )}
          <label htmlFor="mkAmt" style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", marginTop: 18 }}>{isBuy ? "PAY (BTC)" : "SELL (PRINCIPAL)"}</label>
          <input id="mkAmt" className="line" style={{ fontSize: 28, padding: "6px 0" }} value={pay} onChange={(e) => setPay(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="0" />
          <PctButtons balance={w.address ? (isBuy ? myBtc : held) : null} reserve={isBuy ? BTC_GAS_RESERVE : 0} decimals={8} onPick={setPay} label={isBuy ? "BTC" : "Principal"} />
          <p className="pm-get">
            {isBuy
              ? `You get ${small(quote ?? 0)} Principal (worth ${small(quote ?? 0)} BTC on ${pick ? seriesName(pick.endDate) : "its end date"})`
              : `You get ${small(quote ?? 0)} BTC now`}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, fontSize: 13 }}>
            <span>Price impact</span>
            <span className={tooBig ? "c-bear" : undefined}>{impact == null ? "—" : pct(Math.max(impact, 0))}</span>
          </div>
          {tooMuch && <p className="txnote error">{isBuy ? `You have ${small(myBtc!)} BTC in this wallet.` : `You hold ${small(held!)} Principal in this series.`}</p>}
          {tooBig && !tooMuch && (
            <p className="txnote error">
              Too large for the pool right now, try a smaller amount.
              {largest != null && largest > 0 && (
                <>
                  {" "}The largest under 5% is about{" "}
                  <button type="button" className="linkbtn" onClick={() => setPay(String(Math.floor(largest * 1e8) / 1e8))}>{small(largest)} {isBuy ? "BTC" : "Principal"}</button>.
                </>
              )}
            </p>
          )}
          <button type="button" className="btn-strong" style={{ marginTop: 20, height: 54, fontSize: 15 }} onClick={go} disabled={!pick || !quote || tooMuch || tooBig || busy(w.tx, "buy")}>
            {busy(w.tx, "buy")
              ? isBuy ? "BUYING…" : "SELLING…"
              : n <= 0 ? "ENTER AN AMOUNT"
              : tooMuch ? (isBuy ? "NOT ENOUGH BTC" : "NOT ENOUGH PRINCIPAL")
              : tooBig ? "TOO LARGE FOR THE POOL"
              : isBuy ? `BUY FOR A ${pct(orderReturn)} FIXED RETURN`
              : quote ? `SELL FOR ${small(quote)} BTC` : "SELL FOR BTC"}
          </button>
          <TxNote k="buy" />
        </section>
      </div>
    </>
  );
}
