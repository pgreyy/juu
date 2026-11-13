"use client";
import { fmt } from "@juu/ui";
import { Contract, formatUnits, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { BTC_GAS_RESERVE, PctButtons } from "@/components/PctButtons";
import { ABI } from "@/lib/abis";
import { useRead } from "@/lib/data";
import { JUUSWAP_ABI, POOL_ABI, ROUTER_ABI, SWAP, SYMS, route, type Sym } from "@/lib/swap";
import { EXPLORER, call, read, reader, useWallet } from "@/lib/wallet";

const n18 = (x: bigint) => Number(formatUnits(x, 18));
/** Amounts as people read them: BTC to 8 places when small, MUSD and MEZO to 2 (4 when tiny). */
const show = (s: Sym, v: number) =>
  s === "BTC" ? (v > 0 && v < 0.01 ? fmt(v, 8).replace(/0+$/, "").replace(/\.$/, "") : fmt(v, 6)) : v > 0 && v < 1 ? fmt(v, 4) : fmt(v, 2);
const SLIPS = [0.1, 0.5, 1];
/** Long amounts get a smaller size so they fit the box instead of being cut off. */
const fit = (text: string) => ({ fontSize: text.length > 11 ? "clamp(14px, 4vw, 22px)" : text.length > 8 ? "clamp(16px, 4.6vw, 26px)" : "clamp(22px, 6.4vw, 32px)" });

function TokenSelect({ value, onChange, label }: { value: Sym; onChange: (s: Sym) => void; label: string }) {
  return (
    <select className="sc-token" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Sym)}>
      {SYMS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function Gear() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

/**
 * Swap on Mezo's own pools through Mezo's Router (lib/swap.ts holds the addresses). One card: From, flip, To, the rate,
 * folded details, and one button that says exactly what will happen.
 */
export function SwapCard({ initialFrom, initialTo }: { initialFrom?: Sym; initialTo?: Sym }) {
  const w = useWallet();
  const startFrom: Sym = initialFrom || (initialTo === "BTC" ? "MUSD" : "BTC");
  const [from, setFrom] = useState<Sym>(startFrom);
  const [to, setTo] = useState<Sym>(initialTo && initialTo !== startFrom ? initialTo : startFrom === "MUSD" ? "BTC" : "MUSD");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState(0.5);
  const [custom, setCustom] = useState("");
  const [gear, setGear] = useState(false);
  const [done, setDone] = useState<{ got: number; sym: Sym; hash?: string } | null>(null);
  const slipPct = custom ? Number(custom) || 0 : slip;

  const hops = route(from, to);
  const n = Number(amount.replace(/,/g, "")) || 0;
  const routes = (hops || []).map((h) => ({ from: SWAP.tokens[h.from]!, to: SWAP.tokens[h.to]!, stable: false, factory: SWAP.factory }));

  const bals = useRead(w.address ? `swapbal-${w.address}` : null, async () => {
    const out: Partial<Record<Sym, number>> = {};
    await Promise.all(SYMS.map(async (s) => (out[s] = s === "BTC" ? n18(await reader.getBalance(w.address!)) : n18(await read(SWAP.tokens[s]!, ABI.erc20).balanceOf(w.address)))));
    return out;
  }, 15000, w.bump);
  // Swaps go through JuuSwap (Juu fee, then Mezo's Router) where it exists, else straight through Mezo's Router.
  const spender = SWAP.juuSwap ?? SWAP.router;
  const allowance = useRead(w.address ? `swapallow-${from}-${spender}-${w.address}` : null, async () => n18(await read(SWAP.tokens[from]!, ABI.erc20).allowance(w.address, spender)), 15000, w.bump);
  const juuFee = useRead(SWAP.juuSwap ? "juu-fee" : null, async () => {
    const c = read(SWAP.juuSwap!, JUUSWAP_ABI);
    const [rate, on] = await Promise.all([c.feeRate(), c.feeOn()]);
    return on ? n18(rate) : 0;
  }, 300000);

  // Quote after the Juu fee (JuuSwap.quote), plus the pools' current prices for the price impact of the swapped part.
  const quote = useRead(hops && n > 0 ? `swapq-${from}-${to}-${n}` : null, async () => {
    let fee = 0, out: number;
    if (SWAP.juuSwap) {
      const q = await read(SWAP.juuSwap, JUUSWAP_ABI).quote(parseUnits(String(n), 18), routes);
      fee = n18(q.fee);
      out = n18(q.amountOut);
    } else {
      const outs: bigint[] = await read(SWAP.router, ROUTER_ABI).getAmountsOut(parseUnits(String(n), 18), routes);
      out = n18(outs[outs.length - 1]);
    }
    let spot = n - fee;
    for (const h of hops!) {
      const p = read(h.pool, POOL_ABI);
      const [t0, r] = await Promise.all([p.token0(), p.getReserves()]);
      const inIs0 = t0.toLowerCase() === SWAP.tokens[h.from]!.toLowerCase();
      const [rin, rout] = inIs0 ? [n18(r[0]), n18(r[1])] : [n18(r[1]), n18(r[0])];
      spot = rin > 0 ? (spot * rout) / rin : 0;
    }
    return { out, spot, fee };
  }, 15000);
  // The rate for 1 unit, shown before an amount is typed.
  const unitRate = useRead(hops ? `swaprate-${from}-${to}` : null, async () => {
    const one = from === "BTC" ? 0.001 : 1;
    const outs: bigint[] = await read(SWAP.router, ROUTER_ABI).getAmountsOut(parseUnits(String(one), 18), routes);
    return n18(outs[outs.length - 1]) / one;
  }, 30000);

  const have = bals?.[from] ?? 0;
  const impact = quote && quote.spot > 0 ? Math.max(0, 1 - quote.out / quote.spot) : 0;
  const minOut = quote ? quote.out * (1 - slipPct / 100) : 0;
  const short = n > 0 && n > have - (from === "BTC" ? BTC_GAS_RESERVE : 0);
  const tooBig = impact > 0.05;
  const badSlip = !(slipPct > 0 && slipPct <= 20);
  const needsApprove = allowance != null && n > 0 && allowance < n;
  const rate = quote && n > 0 ? quote.out / n : unitRate != null ? unitRate * (1 - (juuFee ?? 0)) : null;

  const pick = (side: "from" | "to", s: Sym) => {
    setDone(null);
    if (side === "from") {
      if (s === to) setTo(from);
      setFrom(s);
    } else {
      if (s === from) setFrom(to);
      setTo(s);
    }
  };
  const flip = () => {
    setDone(null);
    setFrom(to);
    setTo(from);
    setAmount(quote ? String(Number(quote.out.toPrecision(6))) : "");
  };

  const go = async () => {
    if (!w.address) return void w.connect();
    if (!w.chainOk) return void w.switchNetwork();
    if (!quote || !hops || n <= 0 || short || tooBig || badSlip) return;
    const v = parseUnits(String(n), 18);
    const min = parseUnits(minOut.toFixed(12), 18);
    const before = bals?.[to] ?? 0;
    const tokenIn = SWAP.tokens[from]!;
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const ok = await w.run(
      "swap",
      [
        async (s: Signer) => {
          const t = new Contract(tokenIn, ABI.erc20, s);
          return (await t.allowance(await s.getAddress(), spender)) >= v ? null : call(t, "approve", [spender, v]);
        },
        async (s: Signer) =>
          SWAP.juuSwap
            ? call(new Contract(SWAP.juuSwap, JUUSWAP_ABI, s), "swap", [v, min, routes, await s.getAddress(), deadline])
            : call(new Contract(SWAP.router, ROUTER_ABI, s), "swapExactTokensForTokens", [v, min, routes, await s.getAddress(), deadline]),
      ],
      "Swapped.",
    );
    if (ok) {
      const after = to === "BTC" ? n18(await reader.getBalance(w.address)) : n18(await read(SWAP.tokens[to]!, ABI.erc20).balanceOf(w.address));
      setDone({ got: Math.max(0, after - before), sym: to });
      setAmount("");
    }
  };

  const busyNow = w.tx?.key === "swap" && (w.tx.state === "wallet" || w.tx.state === "pending");
  // One button; its words say what will happen, or what is missing.
  const label = busyNow
    ? w.tx?.state === "wallet" ? "Confirm in your wallet…" : "Swapping…"
    : !w.address ? "Connect wallet"
    : !w.chainOk ? "Switch to Mezo"
    : !hops ? "No pool for this pair"
    : n <= 0 ? "Enter an amount"
    : short ? `Not enough ${from}`
    : !quote ? "Getting a price…"
    : tooBig ? "Too large for the pool"
    : badSlip ? "Set a slippage up to 20%"
    : needsApprove ? `Approve ${from}`
    : `Swap ${show(from, n)} ${from} for ${show(to, quote.out)} ${to}`;
  const off = busyNow || (Boolean(w.address) && w.chainOk && (!hops || n <= 0 || short || !quote || tooBig || badSlip));

  return (
    <section className="sc" aria-label="Swap">
      <div className="sc-box">
        <div className="sc-top">
          <span className="sc-k">From</span>
          <span className="sc-bal">{w.address ? `Balance ${show(from, have)}` : ""}</span>
        </div>
        <div className="sc-mid">
          <input className="sc-amt" style={fit(amount)} aria-label={`Amount of ${from} to swap`} value={amount} onChange={(e) => { setDone(null); setAmount(e.target.value); }} inputMode="decimal" autoComplete="off" placeholder="0" />
          <TokenSelect value={from} onChange={(s) => pick("from", s)} label="Swap from" />
        </div>
        <PctButtons balance={w.address ? have : null} reserve={from === "BTC" ? BTC_GAS_RESERVE : 0} decimals={from === "BTC" ? 8 : 4} onPick={(v) => { setDone(null); setAmount(v); }} label={from} />
      </div>
      <div className="sc-flipwrap">
        <button type="button" className="sc-flip" onClick={flip} aria-label="Swap direction">↓</button>
      </div>
      <div className="sc-box">
        <div className="sc-top">
          <span className="sc-k">To</span>
          <span className="sc-bal">{w.address ? `Balance ${show(to, bals?.[to] ?? 0)}` : ""}</span>
        </div>
        <div className="sc-mid">
          <output className="sc-amt sc-out" style={fit(quote ? show(to, quote.out) : "0")} aria-live="polite">{quote ? show(to, quote.out) : "0"}</output>
          <TokenSelect value={to} onChange={(s) => pick("to", s)} label="Swap to" />
        </div>
      </div>
      <p className="sc-rate">{rate ? `1 ${from} = ${show(to, rate)} ${to}` : hops ? " " : "No pool for this pair"}</p>
      <details className="sc-details">
        <summary>
          <span>Details</span>
          <button type="button" className="sc-gear" aria-label="Slippage settings" aria-expanded={gear} onClick={(e) => { e.preventDefault(); setGear(!gear); (e.currentTarget.closest("details") as HTMLDetailsElement).open = true; }}>
            <Gear /> <span>{slipPct}%</span>
          </button>
        </summary>
        <dl>
          {SWAP.juuSwap && (
            <>
              <dt>Juu fee {fmt((juuFee ?? 0.001) * 100, 1)}%</dt><dd>{show(from, quote?.fee ?? 0)} {from}</dd>
            </>
          )}
          <dt>Price impact</dt><dd className={tooBig ? "c-bear" : undefined}>{fmt(impact * 100, 2)}%</dd>
          <dt>Minimum received</dt><dd>{show(to, minOut)} {to}</dd>
          <dt>Slippage</dt><dd>{slipPct}%</dd>
          <dt>Route</dt><dd>{hops ? hops.map((h) => h.from).concat(to).join(" → ") : "none"} (Mezo pools)</dd>
        </dl>
        {gear && (
          <div className="sc-slip" role="group" aria-label="Slippage">
            {SLIPS.map((s) => (
              <button key={s} type="button" aria-pressed={!custom && slip === s} onClick={() => { setSlip(s); setCustom(""); }}>{s}%</button>
            ))}
            <input aria-label="Custom slippage in percent" placeholder="custom %" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" />
          </div>
        )}
      </details>
      <button type="button" className="sc-go" onClick={go} disabled={off}>{label}</button>
      {needsApprove && !off && !busyNow && <p className="sc-note">One approval{SWAP.juuSwap ? "" : " for Mezo's Router"}, then the swap, in two wallet steps.</p>}
      {tooBig && <p className="sc-note c-bear">This would move the pool&apos;s price by more than 5%. Try a smaller amount.</p>}
      {w.tx?.key === "swap" && w.tx.state === "error" && <p className="sc-note c-bear" role="alert">{w.tx.msg}</p>}
      {done && (
        <p className="sc-done" role="status">
          Swapped. You received {show(done.sym, done.got)} {done.sym}.{" "}
          {w.tx?.key === "swap" && w.tx.hash && <a href={`${EXPLORER}/tx/${w.tx.hash}`} target="_blank" rel="noreferrer">View transaction</a>}
        </p>
      )}
    </section>
  );
}
