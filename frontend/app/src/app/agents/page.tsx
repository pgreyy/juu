"use client";
import { fmt, shortAddr } from "@juu/ui";
import { Contract, isAddress, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { stackAddr, usePoll, useStack } from "@/lib/data";
import { call, useWallet } from "@/lib/wallet";

type Session = { agent: string; active: boolean; expires: string; maxChipsMUSD: number; maxFloor: number; dailyLossLimitMUSD: number; lossTodayMUSD: number; netTodayMUSD: number; canSetLoop: boolean };
type Fee = { rateOfSize: number; minimumMUSD: number; toBuffer: number; toBank: number };

function expiresText(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.round(ms / 3600000), d = Math.round(ms / 86400000);
  return h >= 36 ? `In ${d} days` : h >= 1 ? `In ${h} hour${h === 1 ? "" : "s"}` : "In under an hour";
}

export default function Agents() {
  const { stack } = useStack();
  const A = stackAddr(stack);
  const w = useWallet();
  const sessions = usePoll<{ sessions: Session[] }>(w.address ? `/api/${stack}/agents/${w.address}` : null, 30000, w.bump);
  const fee = usePoll<Fee>(`/api/${stack}/agent-fee`, 300000);
  const [agent, setAgent] = useState("");
  const [maxBet, setMaxBet] = useState("500");
  const [floor, setFloor] = useState("6");
  const [loss, setLoss] = useState("200");
  const [days, setDays] = useState("7");

  const gw = (s: Signer) => new Contract(A.gateway, ABI.gateway, s);
  const grant = (who: string, maxChips: number, maxFloor: number, dailyLoss: number, d: number, key: string) => {
    const expiry = Math.floor(Date.now() / 1000) + Math.round(d * 86400);
    // The agent spends your MUSD through the gateway, so the gateway also needs an allowance: ten bets' worth.
    const allowance = parseUnits(String(maxChips * 10), 18);
    w.run(
      key,
      [
        (s) => call(gw(s), "grant", [who, parseUnits(String(maxChips), 18), maxFloor, parseUnits(String(dailyLoss), 18), expiry, false]),
        async (s) => {
          const t = new Contract(ADDR.mezo.musd, ABI.erc20, s);
          return (await t.allowance(await s.getAddress(), A.gateway)) >= allowance ? null : call(t, "approve", [A.gateway, allowance]);
        },
      ],
      "Permission given.",
    );
  };
  const add = () => {
    if (!isAddress(agent)) return;
    grant(agent, Number(maxBet) || 0, Number(floor), Number(loss) || 0, Number(days) || 1, "grant");
  };

  const list = sessions.data?.sessions || [];
  const valid = isAddress(agent) && Number(maxBet) > 0 && Number(days) > 0;

  return (
    <>
      <h1 className="h1">AGENTS</h1>
      <p className="lede">Let your bot play. You set the rules. You can pull the plug any time.</p>
      <div className="agents">
        {!w.address && (
          <section className="agent" style={{ display: "flex", alignItems: "center" }}>
            <p className="c-muted mono" style={{ fontSize: 13, margin: 0 }}>Connect a wallet to see the agents you have allowed to play for you.</p>
          </section>
        )}
        {w.address && sessions.data && list.length === 0 && (
          <section className="agent" style={{ display: "flex", alignItems: "center" }}>
            <p className="c-muted mono" style={{ fontSize: 13, margin: 0 }}>No agents yet. Give one permission on the right.</p>
          </section>
        )}
        {list.map((a) => {
          const expired = new Date(a.expires).getTime() <= Date.now();
          const on = a.active && !expired;
          const key = "agent-" + a.agent;
          return (
            <section className="agent" key={a.agent} style={{ opacity: on ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--fD)", fontWeight: 700, fontSize: 22 }} title={a.agent}>{shortAddr(a.agent)}</span>
                <span className={"st" + (on ? " on" : "")}>{on ? "ACTIVE" : expired && a.active ? "EXPIRED" : "REVOKED"}</span>
              </div>
              <div className={"mono " + (a.netTodayMUSD > 0.005 ? "c-bull" : a.netTodayMUSD < -0.005 ? "c-bear" : "c-ink")} style={{ fontSize: 30, marginTop: 10 }}>
                {a.netTodayMUSD > 0.005 ? "+" + fmt(a.netTodayMUSD, 2) : a.netTodayMUSD < -0.005 ? "−" + fmt(-a.netTodayMUSD, 2) : "0.00"}
              </div>
              <div className="label">{a.netTodayMUSD > 0.005 ? "▲ PROFIT TODAY" : a.netTodayMUSD < -0.005 ? "▼ LOSS TODAY" : "NET TODAY"} · MUSD</div>
              <dl className="readout" style={{ marginTop: 14 }}>
                <dt>Max per bet</dt><dd>{fmt(a.maxChipsMUSD)} MUSD</dd>
                <dt>Highest floor</dt><dd>Up to {a.maxFloor}</dd>
                <dt>Daily loss stop</dt><dd>{fmt(a.lossTodayMUSD, 2)} of {fmt(a.dailyLossLimitMUSD)} MUSD used</dd>
                <dt>Expires</dt><dd>{expiresText(a.expires)}</dd>
              </dl>
              <button
                type="button"
                className={"btn-line" + (on ? " btn-on" : "")}
                style={{ marginTop: 16, width: "100%", height: 50, fontSize: 13, letterSpacing: "0.06em" }}
                disabled={busy(w.tx, key)}
                onClick={() =>
                  on
                    ? w.run(key, [(s) => call(gw(s), "revoke", [a.agent])], "Revoked. The agent can't play for you any more.")
                    : grant(a.agent, a.maxChipsMUSD, a.maxFloor, a.dailyLossLimitMUSD, 7, key)
                }
              >
                {on ? "REVOKE NOW" : "RESTORE PERMISSION"}
              </button>
              <TxNote k={key} wallet={false} />
            </section>
          );
        })}
        <section className="panel" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--fD)", fontWeight: 700, fontSize: 22 }}>+ NEW AGENT</div>
          <label htmlFor="agAddr" style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", marginTop: 14 }}>AGENT ADDRESS</label>
          <input id="agAddr" className="line" style={{ fontSize: 16 }} placeholder="0x…" value={agent} onChange={(e) => setAgent(e.target.value.trim())} autoComplete="off" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
            <div>
              <label htmlFor="agMax" style={{ fontSize: 11, letterSpacing: "0.12em" }}>MAX PER BET (MUSD)</label>
              <input id="agMax" className="line" style={{ fontSize: 15 }} value={maxBet} onChange={(e) => setMaxBet(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label htmlFor="agFloor" style={{ fontSize: 11, letterSpacing: "0.12em" }}>HIGHEST FLOOR</label>
              <select id="agFloor" className="line" style={{ fontSize: 15 }} value={floor} onChange={(e) => setFloor(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="agLoss" style={{ fontSize: 11, letterSpacing: "0.12em" }}>DAILY LOSS STOP (MUSD)</label>
              <input id="agLoss" className="line" style={{ fontSize: 15 }} value={loss} onChange={(e) => setLoss(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label htmlFor="agExp" style={{ fontSize: 11, letterSpacing: "0.12em" }}>EXPIRES IN (DAYS)</label>
              <input id="agExp" className="line" style={{ fontSize: 15 }} value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "14px 0 0", fontFamily: "var(--fB)" }}>
            Every agent move pays a small extra fee
            {fee.data ? ` (${fmt(fee.data.rateOfSize * 100, 2)}% of size, at least ${fmt(fee.data.minimumMUSD, 2)} MUSD)` : ""}, split between the safety jar and the Bank. Giving
            permission also lets the gateway use up to ten bets&apos; worth of your MUSD, only under these rules.
          </p>
          <button type="button" className="btn-strong" style={{ marginTop: 14, height: 52, fontSize: 14 }} onClick={add} disabled={!valid || busy(w.tx, "grant")}>
            {busy(w.tx, "grant") ? "WAITING…" : "GIVE PERMISSION"}
          </button>
          <TxNote k="grant" />
        </section>
      </div>
    </>
  );
}
