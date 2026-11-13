"use client";
import { fmt } from "@juu/ui";
import { Contract, ZeroAddress, formatUnits, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { stackAddr, useRead, useStack } from "@/lib/data";
import { btc, seriesName } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { call, read, useWallet } from "@/lib/wallet";

type DoorKey = "btc" | "ve" | "smusd" | "trove";
const DOORS: { k: DoorKey; code: string; title: string; desc: string; unit: string; note: string }[] = [
  { k: "btc", code: "01", title: "BTC", desc: "One click: locked on Mezo, then split into Principal and Yield.", unit: "BTC", note: "Zap: your BTC is locked as veBTC by Mezo and held by Juu until the end date." },
  { k: "ve", code: "02", title: "veBTC LOCK", desc: "Already locked on Mezo? Bring the NFT in.", unit: "LOCK ID", note: "Collect your own rewards first. Anything unclaimed moves with the lock. A lock that voted this week can come in next week." },
  { k: "smusd", code: "03", title: "sMUSD", desc: "Mezo's savings token, split into Principal and Yield.", unit: "sMUSD", note: "Principal is your MUSD back. Yield is the savings yield stream." },
  { k: "trove", code: "04", title: "TROVE", desc: "A fresh Mezo loan inside your own Juu account.", unit: "BTC", note: "Opens a new trove in your Juu account. Mezo's minimum loan is 2,000 MUSD (1,800 MUSD to you plus Mezo's 200 MUSD gas deposit). Or just bring the MUSD you borrowed." },
];

export default function Doors() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const m = useMarket();
  const [door, setDoor] = useState<DoorKey>("btc");
  const [amount, setAmount] = useState("0.0100");
  const [debt, setDebt] = useState("1800");
  const [pickId, setPickId] = useState<number | null>(null);
  const d = DOORS.find((x) => x.k === door)!;

  const kind = door === "smusd" ? "sMUSD" : "veBTC";
  const options = (m.series || [])
    .filter((s) => s.kind === kind && (kind === "veBTC" ? s.phase === "Open" : !s.matured && new Date(s.endDate).getTime() > Date.now()))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const picked = options.find((s) => s.id === pickId) || options[0] || null;
  const name = picked ? seriesName(picked.endDate) : "—";

  const n = Number(amount.replace(/,/g, "")) || 0;
  const tokenId = door === "ve" && /^\d+$/.test(amount.trim()) ? amount.trim() : null;
  const lock = useRead(tokenId ? `lock-${tokenId}` : null, async () => {
    const l = await read(ADDR.mezo.veBTC, ABI.ve).locked(tokenId);
    return Number(formatUnits(l.amount, 18));
  });
  const youGet = door === "ve" ? lock ?? 0 : door === "trove" ? 0 : n;
  const fmtGet = (v: number) => (door === "smusd" ? fmt(v, 2) : btc(v));

  const enter = () => {
    if (door !== "trove" && !picked) return;
    let steps: ((s: Signer) => Promise<unknown>)[] = [];
    if (door === "btc") {
      steps = [async (s) => call(new Contract(ADDR.shared.splitter, ABI.splitter, s), "zap", [picked!.id, await s.getAddress()], { value: parseUnits(String(n), 18) })];
    } else if (door === "ve") {
      if (!tokenId) return;
      steps = [
        (s) => call(new Contract(ADDR.mezo.veBTC, ABI.ve, s), "approve", [ADDR.shared.splitter, tokenId]),
        (s) => call(new Contract(ADDR.shared.splitter, ABI.splitter, s), "deposit", [picked!.id, tokenId]),
      ];
    } else if (door === "smusd") {
      const v = parseUnits(String(n), 18);
      steps = [
        async (s) => {
          const t = new Contract(ADDR.mezo.smusd, ABI.erc20, s);
          return (await t.allowance(await s.getAddress(), ADDR.shared.savings)) >= v ? null : call(t, "approve", [ADDR.shared.savings, v]);
        },
        (s) => call(new Contract(ADDR.shared.savings, ABI.savings, s), "deposit", [picked!.id, v]),
      ];
    } else {
      if (!A.accountFactory) return;
      const f = (s: Signer) => new Contract(A.accountFactory!, ABI.factory, s);
      steps = [
        async (s) => ((await f(s).accountOf(await s.getAddress())) === ZeroAddress ? call(f(s), "create", []) : null),
        async (s) => {
          const acc = await f(s).accountOf(await s.getAddress());
          return call(new Contract(acc, ABI.account, s), "openTrove", [parseUnits(debt || "0", 18)], { value: parseUnits(String(n), 18) });
        },
      ];
    }
    w.run("door", steps, door === "trove" ? "Your Juu account has its trove." : `In. You hold Principal and Yield of ${name}.`);
  };

  const disabled = busy(w.tx, "door") || (door === "trove" ? !A.accountFactory || n <= 0 : !picked || (door === "ve" ? !tokenId : n <= 0));

  return (
    <>
      <h1 className="h1">DOORS</h1>
      <p className="lede">Bring something in. Juu splits it into Principal and Yield.</p>
      <div className="doors">
        {DOORS.map((x) => (
          <button
            key={x.k}
            type="button"
            className="door"
            aria-pressed={door === x.k}
            onClick={() => {
              setDoor(x.k);
              setAmount(x.k === "ve" ? "" : x.k === "smusd" ? "100" : "0.0100");
            }}
          >
            <span className="code">{x.code}</span>
            <span className="ttl">{x.title}</span>
            <span className="desc">{x.desc}</span>
          </button>
        ))}
      </div>
      <div className="split">
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="label">{d.title}</div>
          <label htmlFor="doorAmt" className="label" style={{ display: "block", marginTop: 14 }}>{door === "ve" ? "LOCK ID" : door === "trove" ? "COLLATERAL" : "AMOUNT"}</label>
          <div className="amount-row">
            <input id="doorAmt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode={door === "ve" ? "numeric" : "decimal"} placeholder={door === "ve" ? "veBTC NFT id" : "0"} autoComplete="off" />
            <span className="unit">{d.unit}</span>
          </div>
          {door === "trove" ? (
            <>
              <label htmlFor="doorDebt" className="label" style={{ display: "block", marginTop: 16 }}>BORROW</label>
              <div className="amount-row">
                <input id="doorDebt" value={debt} onChange={(e) => setDebt(e.target.value)} inputMode="decimal" autoComplete="off" />
                <span className="unit">MUSD</span>
              </div>
              {!A.accountFactory && <p className="txnote error">Juu accounts run on the main stack only.</p>}
            </>
          ) : (
            <>
              <div className="label mt16">SERIES (END DATE)</div>
              <div className="series-picks">
                {options.length === 0 && <span className="c-muted mono" style={{ fontSize: 12, padding: "12px 0" }}>{m.series ? "No series open for this door right now." : "Loading series…"}</span>}
                {options.map((s) => (
                  <button key={s.id} type="button" aria-pressed={picked?.id === s.id} onClick={() => setPickId(s.id)}>{seriesName(s.endDate)}</button>
                ))}
              </div>
            </>
          )}
          <p className="note">{d.note}</p>
        </div>
        <div className="panel" style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>YOU GET</div>
            {door === "trove" ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}><span>Your Juu account</span><span style={{ fontSize: 20 }}>1</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>MUSD to play with</span><span style={{ fontSize: 20 }}>{fmt(Number(debt) || 0)}</span></div>
                <p style={{ fontFamily: "var(--fB)", fontSize: 13, margin: "14px 0 0", lineHeight: 1.5 }}>Only you control the account. Juu's guard closes bets if the loan gets near danger.</p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}><span>Principal · {name}</span><span style={{ fontSize: 20 }}>{fmtGet(youGet)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 14 }}><span>Yield · {name}</span><span style={{ fontSize: 20 }}>{fmtGet(youGet)}</span></div>
                <p style={{ fontFamily: "var(--fB)", fontSize: 13, margin: "14px 0 0", lineHeight: 1.5 }}>
                  {door === "smusd" ? `Your MUSD stays in Juu until ${name}.` : `Your BTC stays locked in Juu until ${name}.`}
                </p>
              </>
            )}
          </div>
          <div>
            <button type="button" className="btn-strong" style={{ height: 54, fontSize: 15 }} onClick={enter} disabled={disabled}>
              {busy(w.tx, "door") ? "ENTERING…" : "ENTER THROUGH THIS DOOR"}
            </button>
            <TxNote k="door" />
          </div>
        </div>
      </div>
    </>
  );
}
