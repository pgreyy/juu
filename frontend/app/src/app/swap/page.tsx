"use client";
import { fmt } from "@juu/ui";
import { Contract, formatUnits, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { useRead } from "@/lib/data";
import { POOL_ABI, ROUTER_ABI, SWAP, SYMS, route, type Sym } from "@/lib/swap";
import { call, read, reader, useWallet } from "@/lib/wallet";

const n18 = (x: bigint) => Number(formatUnits(x, 18));
const show = (s: Sym, v: number) => (s === "BTC" ? (v > 0 && v < 0.01 ? fmt(v, 8) : fmt(v, 6)) : fmt(v, 4));
const SLIPS = [0.1, 0.5, 1];
// Leave a little BTC for gas when swapping BTC away.
const GAS_LEFT = 0.00001;

export default function Swap() {
  const w = useWallet();
  const [from, setFrom] = useState<Sym>("BTC");
  const [to, setTo] = useState<Sym>("MUSD");
  const [amount, setAmount] = useState("0.0001");
  const [slip, setSlip] = useState(0.5);
  const [custom, setCustom] = useState("");
  const slipPct = custom ? Number(custom) || 0 : slip;

  const hops = route(from, to);
  const n = Number(amount.replace(/,/g, "")) || 0;
  const routes = (hops || []).map((h) => ({ from: SWAP.tokens[h.from]!, to: SWAP.tokens[h.to]!, stable: false, factory: SWAP.factory }));

  // Balances of the three tokens (BTC is the native coin; its ERC-20 view gives the same number).
  const bals = useRead(w.address ? `swapbal-${w.address}` : null, async () => {
    const out: Partial<Record<Sym, number>> = {};
    await Promise.all(SYMS.map(async (s) => (out[s] = s === "BTC" ? n18(await reader.getBalance(w.address!)) : n18(await read(SWAP.tokens[s]!, ABI.erc20).balanceOf(w.address)))));
    return out;
  }, 15000, w.bump);

  // Quote from Mezo's Router, and the pools' current prices (reserves) for the price impact.
  const quote = useRead(hops && n > 0 ? `swapq-${from}-${to}-${n}` : null, async () => {
    const outs: bigint[] = await read(SWAP.router, ROUTER_ABI).getAmountsOut(parseUnits(String(n), 18), routes);
    let spot = n;
    for (const h of hops!) {
      const p = read(h.pool, POOL_ABI);
      const [t0, r] = await Promise.all([p.token0(), p.getReserves()]);
      const inIs0 = t0.toLowerCase() === SWAP.tokens[h.from]!.toLowerCase();
      const [rin, rout] = inIs0 ? [n18(r[0]), n18(r[1])] : [n18(r[1]), n18(r[0])];
      spot = rin > 0 ? (spot * rout) / rin : 0;
    }
    return { out: n18(outs[outs.length - 1]), spot };
  }, 15000);

  const impact = quote && quote.spot > 0 ? Math.max(0, 1 - quote.out / quote.spot) : null;
  const minOut = quote ? quote.out * (1 - slipPct / 100) : 0;
  const have = bals?.[from] ?? null;
  const short = have != null && n > 0 && n > have - (from === "BTC" ? GAS_LEFT : 0);
  const tooBig = impact != null && impact > 0.05;
  const badSlip = !(slipPct > 0 && slipPct <= 20);

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount(quote ? String(Number(quote.out.toPrecision(6))) : "");
  };
  const pick = (side: "from" | "to", s: Sym) => {
    if (side === "from") {
      if (s === to) setTo(from);
      setFrom(s);
    } else {
      if (s === from) setFrom(to);
      setTo(s);
    }
  };

  const go = () => {
    if (!quote || !hops || n <= 0) return;
    const v = parseUnits(String(n), 18);
    const min = parseUnits(minOut.toFixed(12), 18);
    const tokenIn = SWAP.tokens[from]!;
    w.run(
      "swap",
      [
        async (s: Signer) => {
          const t = new Contract(tokenIn, ABI.erc20, s);
          return (await t.allowance(await s.getAddress(), SWAP.router)) >= v ? null : call(t, "approve", [SWAP.router, v]);
        },
        async (s: Signer) => call(new Contract(SWAP.router, ROUTER_ABI, s), "swapExactTokensForTokens", [v, min, routes, await s.getAddress(), Math.floor(Date.now() / 1000) + 600]),
      ],
      `Swapped ${show(from, n)} ${from} for ${to}.`,
    );
  };

  const Picker = ({ side, value }: { side: "from" | "to"; value: Sym }) => (
    <div className="sw-picks" role="radiogroup" aria-label={side === "from" ? "Pay with" : "Receive"}>
      {SYMS.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} className="chip" onClick={() => pick(side, s)}>{s}</button>
      ))}
    </div>
  );

  return (
    <>
      <h1 className="h1">SWAP</h1>
      <p className="lede">Swap BTC, MUSD and MEZO on Mezo&apos;s own pools, through Mezo&apos;s Router. Juu adds no fee.</p>
      <section className="panel swap" aria-label="Swap">
        <div className="sw-row">
          <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>YOU PAY</div>
          <div style={{ fontSize: 12 }}>{w.address ? `Balance ${show(from, have ?? 0)} ${from}` : ""}</div>
        </div>
        <Picker side="from" value={from} />
        <input aria-label={`Amount of ${from}`} className="line sw-amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" />
        <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
          <button type="button" className="btn-line sw-flip" onClick={flip} aria-label="Swap direction">↓↑</button>
        </div>
        <div className="sw-row">
          <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>YOU GET (ESTIMATE)</div>
          <div style={{ fontSize: 12 }}>{w.address ? `Balance ${show(to, bals?.[to] ?? 0)} ${to}` : ""}</div>
        </div>
        <Picker side="to" value={to} />
        <div className="sw-amt" style={{ padding: "8px 0", borderBottom: "1.5px solid var(--onPanel)" }}>{quote ? show(to, quote.out) : hops ? "0" : "—"}</div>

        <dl className="readout" style={{ marginTop: 16 }}>
          <dt>Route</dt><dd>{hops ? hops.map((h) => h.from).concat(to).join(" → ") : "no pool for this pair"}</dd>
          <dt>Rate</dt><dd>{quote && n > 0 ? `1 ${from} = ${show(to, quote.out / n)} ${to}` : "0"}</dd>
          <dt>Price impact</dt><dd className={tooBig ? "c-bear" : undefined}>{fmt((impact ?? 0) * 100, 2)}%</dd>
          <dt>Minimum received</dt><dd>{show(to, minOut)} {to}</dd>
        </dl>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", marginTop: 16 }}>SLIPPAGE</div>
        <div className="sw-slip">
          {SLIPS.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={!custom && slip === s} onClick={() => { setSlip(s); setCustom(""); }}>{s}%</button>
          ))}
          <input aria-label="Custom slippage in percent" className="line" placeholder="custom %" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" />
        </div>
        {short && <p className="txnote error">You have {show(from, have ?? 0)} {from}{from === "BTC" ? " (a little stays for gas)" : ""}.</p>}
        {tooBig && <p className="txnote error">This swap would move the pool&apos;s price by more than 5%. Try a smaller amount.</p>}
        {badSlip && <p className="txnote error">Slippage must be above 0% and at most 20%.</p>}
        <button type="button" className="btn-strong" style={{ height: 54, fontSize: 15, marginTop: 16 }} onClick={go} disabled={!hops || !quote || n <= 0 || short || tooBig || badSlip || busy(w.tx, "swap")}>
          {busy(w.tx, "swap") ? "SWAPPING…" : w.address ? `SWAP ${from} FOR ${to}` : "CONNECT A WALLET TO SWAP"}
        </button>
        <TxNote k="swap" />
        <p className="note" style={{ color: "var(--onPanel)" }}>
          The first swap of a token asks you to approve Mezo&apos;s Router for that amount, then swaps. Price impact includes the pool&apos;s fee.
          {from === "MEZO" || to === "MEZO" ? " The MEZO/MUSD pool on testnet is small, so keep MEZO swaps small." : ""}
        </p>
      </section>
    </>
  );
}
