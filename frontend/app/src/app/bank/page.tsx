"use client";
import { amt, fmt } from "@juu/ui";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useState } from "react";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { stackAddr, usePoll, useRead, useStack } from "@/lib/data";
import { useBtcBalance } from "@/lib/balances";
import { btc } from "@/lib/format";
import type { BankRes } from "@/lib/types";
import { call, read, useWallet } from "@/lib/wallet";

const EARN = [
  { k: "Trading fees", v: "a cut of every move" },
  { k: "Funding", v: "when it covers the crowded side" },
  { k: "Collapses", v: "25% of every penalty" },
  { k: "Cost", v: "1% a year on borrowed MUSD" },
];

export default function Bank() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const [mode, setMode] = useState<"dep" | "wd">("dep");
  const [amount, setAmount] = useState("0.0100");
  const bank = usePoll<BankRes>(`/api/${stack}/bank`, 20000, w.bump);
  const chain = useRead(
    `bank-${stack}-${w.address}`,
    async () => {
      const b = read(A.bank, ABI.bank);
      const [assets, supply, mine] = await Promise.all([b.totalAssetsBTC(), b.totalSupply(), w.address ? b.balanceOf(w.address) : 0n]);
      return { assets: Number(formatUnits(assets, 18)), supply: supply as bigint, mine: mine as bigint, assetsRaw: assets as bigint };
    },
    20000,
    w.bump,
  );
  const shareBTC = chain && chain.supply > 0n ? Number(formatUnits((chain.mine * chain.assetsRaw) / chain.supply, 18)) : 0;
  const isDep = mode === "dep";
  const n = Number(amount.replace(/,/g, "")) || 0;
  const myBtc = useBtcBalance(w.address, w.bump);
  const short = isDep && myBtc != null && n > 0 && n > myBtc - 0.00001;
  const overShare = !isDep && Boolean(w.address) && chain != null && n > shareBTC + 1e-9;
  const cr = bank.data?.trove.collateralRatio ?? null;

  const go = () => {
    if (n <= 0) return;
    const v = parseUnits(String(n), 18);
    if (isDep) {
      w.run("bank", [async (s) => call(new Contract(A.bank, ABI.bank, s), "deposit", [await s.getAddress()], { value: v })], "Deposited into the Bank.");
    } else {
      if (!chain || chain.assetsRaw === 0n) return;
      let shares = (v * chain.supply) / chain.assetsRaw;
      if (shares > chain.mine) shares = chain.mine;
      w.run("bank", [async (s) => call(new Contract(A.bank, ABI.bank, s), "withdraw", [shares, await s.getAddress()])], "Withdrawn. Paid out in BTC.");
    }
  };

  return (
    <>
      <div className="label">YOUR SHARE OF THE BANK</div>
      <div className="big-num">{w.address ? (chain ? btc(shareBTC) : "…") : "—"} <span className="u">BTC</span></div>
      <div className="stats">
        <div className="stat"><div className="k">BANK HOLDS</div><div className="v">{chain ? btc(chain.assets) + " BTC" : "—"}</div></div>
        <div className="stat">
          <div className="k">TROVE SAFETY</div>
          <div className={"v " + (cr == null ? "" : cr >= 1.5 ? "c-bull" : "c-bear")}>{cr == null ? "—" : fmt(cr * 100) + "%"}</div>
        </div>
        <div className="stat"><div className="k">MUSD TO PAY WINNERS</div><div className="v">{bank.data ? amt(bank.data.liquidityMUSD) : "—"}</div></div>
        <div className="stat"><div className="k">CASH RESERVE RULE</div><div className="v c-hi">{bank.data ? fmt(bank.data.cashReserve.share * 100) + "% MUSD" : "—"}</div></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginTop: 24 }}>
        <section style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            <button type="button" className="btn-line" style={{ height: 48, fontSize: 13 }} aria-pressed={isDep} onClick={() => setMode("dep")}>DEPOSIT</button>
            <button type="button" className="btn-line" style={{ height: 48, fontSize: 13 }} aria-pressed={!isDep} onClick={() => setMode("wd")}>WITHDRAW</button>
          </div>
          <label htmlFor="bankAmt" className="label" style={{ display: "block", marginTop: 16 }}>{isDep ? "DEPOSIT" : "WITHDRAW"} BTC</label>
          <div className="amount-row">
            <input id="bankAmt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" />
            <span className="unit">BTC</span>
          </div>
          <p className="note">
            {isDep
              ? `Your BTC becomes Bank shares. The Bank borrows MUSD on Mezo at 1% and backs the game with it. Its trove aims for ${bank.data ? fmt(bank.data.trove.target * 100) : "300"}%.`
              : "You are always paid out in BTC. The MUSD stays in the Bank so winners can be paid."}
          </p>
          <button type="button" className="btn-strong" style={{ height: 54, fontSize: 15, marginTop: 14 }} onClick={go} disabled={busy(w.tx, "bank") || n <= 0 || short || (!isDep && shareBTC <= 0 && Boolean(w.address))}>
            {busy(w.tx, "bank") ? "WAITING…" : isDep ? "DEPOSIT INTO THE BANK" : "WITHDRAW MY SHARE"}
          </button>
          {short && <p className="txnote error">You have {btc(myBtc!)} BTC in this wallet.</p>}
          {overShare && shareBTC > 0 && <p className="txnote">Your share is {btc(shareBTC)} BTC; you&apos;ll get all of it.</p>}
          <TxNote k="bank" />
        </section>
        <section style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div className="label">WHERE THE BANK EARNS</div>
          {EARN.map((e) => (
            <div className="earn-row" key={e.k}><span>{e.k}</span><span>{e.v}</span></div>
          ))}
          {bank.data?.cashReserve.short && <p className="txnote error">The Bank's MUSD is below its cash reserve right now. The keeper tops it up from the trove.</p>}
        </section>
      </div>
    </>
  );
}
