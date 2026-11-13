"use client";
import { fmt, shortAddr } from "@juu/ui";
import { Contract, Wallet, formatUnits, isAddress, parseUnits, type Signer } from "ethers";
import { useState } from "react";
import { ConnectAgent, CopyButton } from "@/components/ConnectAgent";
import { PctButtons } from "@/components/PctButtons";
import { busy, TxNote } from "@/components/TxNote";
import { ABI } from "@/lib/abis";
import { ADDR } from "@/lib/addresses";
import { stackAddr, usePoll, useRead, useStack } from "@/lib/data";
import { call, read, useWallet } from "@/lib/wallet";

type Session = { agent: string; active: boolean; expires: string; maxChipsMUSD: number; maxFloor: number; dailyLossLimitMUSD: number; lossTodayMUSD: number; netTodayMUSD: number; canSetLoop: boolean };
type Fee = { rateOfSize: number; minimumMUSD: number; toBuffer: number; toBank: number };

/** Must match the Data API's hideMessage() exactly: the server rebuilds it to check the signature. */
const hideMessage = (stack: string, user: string, agent: string, time: string) =>
  `Juu: remove agent ${agent} from my Agents page on the ${stack} stack.\nWallet: ${user}\nTime: ${time}\nThis costs nothing and changes nothing on chain.`;

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
  const [maxBet, setMaxBet] = useState("");
  const [floor, setFloor] = useState("6");
  const [loss, setLoss] = useState("200");
  const [days, setDays] = useState("7");
  // New agent: a fresh keypair made in this browser. The key is shown once and kept only in this tab's memory: never
  // sent anywhere, never saved by the app. Or the user's own agent wallet (an address, no key shown).
  const [mode, setMode] = useState<"new" | "own">("new");
  const [gen, setGen] = useState<{ address: string; privateKey: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [fundGas, setFundGas] = useState(true);
  const [created, setCreated] = useState<{ address: string; key: string | null } | null>(null);
  const GAS_BTC = "0.00002";
  const myMusd = useRead(w.address ? `musd-${w.address}` : null, async () => Number(formatUnits(await read(ADDR.mezo.musd, ABI.erc20).balanceOf(w.address), 18)), 30000, w.bump);

  const gw = (s: Signer) => new Contract(A.gateway, ABI.gateway, s);
  const grant = (who: string, maxChips: number, maxFloor: number, dailyLoss: number, d: number, key: string, gasBtc?: string) => {
    const expiry = Math.floor(Date.now() / 1000) + Math.round(d * 86400);
    // The agent spends your MUSD through the gateway, so the gateway also needs an allowance: ten bets' worth.
    const allowance = parseUnits(String(maxChips * 10), 18);
    const steps: ((s: Signer) => Promise<unknown>)[] = [
      (s) => call(gw(s), "grant", [who, parseUnits(String(maxChips), 18), maxFloor, parseUnits(String(dailyLoss), 18), expiry, false]),
      async (s) => {
        const t = new Contract(ADDR.mezo.musd, ABI.erc20, s);
        return (await t.allowance(await s.getAddress(), A.gateway)) >= allowance ? null : call(t, "approve", [A.gateway, allowance]);
      },
    ];
    // A fresh agent wallet has no BTC for gas; Mezo gas is tiny, so a little lasts a long time.
    if (gasBtc) steps.push((s) => s.sendTransaction({ to: who, value: parseUnits(gasBtc, 18) }));
    return w.run(key, steps, gasBtc ? "Permission given and gas sent. Your agent can play." : "Permission given.");
  };

  const own = w.address?.toLowerCase();
  const target = mode === "new" ? gen?.address ?? "" : agent;
  const isSelf = Boolean(own && target && target.toLowerCase() === own);
  const add = async () => {
    if (!isAddress(target) || isSelf) return;
    const ok = await grant(target, Number(maxBet) || 0, Number(floor), Number(loss) || 0, Number(days) || 1, "grant", mode === "new" && fundGas ? GAS_BTC : undefined);
    if (ok) {
      setCreated({ address: target, key: mode === "new" ? gen?.privateKey ?? null : null });
      setGen(null);
      setSaved(false);
      setAgent("");
    }
  };
  const makeKey = () => {
    const k = Wallet.createRandom(); // uses the browser's secure random generator
    setGen({ address: k.address, privateKey: k.privateKey });
    setSaved(false);
    setCreated(null);
  };
  const download = () => {
    if (!gen) return;
    const text = `Juu agent wallet (${stack} stack)\nAddress: ${gen.address}\nPrivate key: ${gen.privateKey}\n\nKeep this private. Anyone with the key can play within this agent's rules until you revoke it on the Agents page.\nNever use it for anything else.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `juu-agent-${gen.address.slice(0, 8)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [removing, setRemoving] = useState<string | null>(null);
  const [removeMsg, setRemoveMsg] = useState<{ agent: string; text: string; ok: boolean } | null>(null);
  // Remove a revoked or expired agent from this list, on every device: the wallet signs a short message (no
  // transaction); the Data API checks it and hides the agent for this wallet. Results stay on the leaderboard.
  const remove = async (agentAddr: string) => {
    if (!w.address) return;
    if (!window.confirm(`Remove agent ${agentAddr} from your list?\n\nIts permission is already off. Its past results stay on the leaderboard. You sign a message to confirm; there is no transaction.`)) return;
    setRemoving(agentAddr);
    setRemoveMsg(null);
    try {
      const time = new Date().toISOString();
      const signature = await w.sign(hideMessage(stack, w.address, agentAddr, time));
      const r = await fetch(`/api/${stack}/agents/${w.address}/hide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: agentAddr, time, signature }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      setRemoveMsg({ agent: agentAddr, text: "Removed.", ok: true });
      await sessions.reload();
    } catch (e) {
      const err = e as { code?: string | number; message?: string };
      setRemoveMsg({ agent: agentAddr, text: err.code === "ACTION_REJECTED" || err.code === 4001 ? "Cancelled in your wallet." : `Couldn't remove it: ${err.message}`, ok: false });
    } finally {
      setRemoving(null);
    }
  };

  const list = sessions.data?.sessions || [];
  const valid = isAddress(target) && !isSelf && Number(maxBet) > 0 && Number(days) > 0 && (mode === "own" || saved);

  return (
    <>
      <h1 className="h1">AGENTS</h1>
      <p className="lede">Let your bot play. You set the rules. You can pull the plug any time.</p>
      <details className="howfund">
        <summary>How agent funding works</summary>
        <div className="howfund-grid">
          {[
            ["WHOSE MONEY", "Yours. At each bet the Agent Gateway takes your MUSD (or your Yield and Principal chips) from your wallet. The agent's wallet holds none."],
            ["HOW MUCH", "Giving permission lets the gateway use up to ten times the max per bet in total (500 → 5,000 MUSD), and only within the rules."],
            ["FEES", "Each bet pays MUSDash's trading fee and the agent fee, from your MUSD."],
            ["WINNINGS", "Everything a closed bet returns goes straight to your wallet (or your Loop), never to the agent."],
            ["GAS", "The agent's wallet pays its own gas in BTC. Mezo gas is tiny: the 0.00002 BTC the app can send lasts a long time."],
            ["CHIPS", "The app approves MUSD only. To let an agent bet Yield or Principal chips, approve those tokens for the gateway too."],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="label" style={{ color: "var(--ink)" }}>{k}</div>
              <p>{v}</p>
            </div>
          ))}
        </div>
      </details>
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
          const isOwnWallet = Boolean(own && a.agent.toLowerCase() === own);
          return (
            <section className="agent" key={a.agent} style={{ opacity: on ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--fD)", fontWeight: 700, fontSize: 22 }} title={a.agent}>{shortAddr(a.agent)}</span>
                <span className={"st" + (on ? " on" : "")}>{on ? "ACTIVE" : expired && a.active ? "EXPIRED" : "REVOKED"}</span>
              </div>
              {isOwnWallet && on && (
                <p className="txnote error" style={{ marginTop: 8 }}>This agent is your own wallet, so its key is your main key. Revoke it and create a new agent below.</p>
              )}
              {isOwnWallet && !on && (
                <p className="txnote" style={{ marginTop: 8 }}>This was your own wallet, so it can&apos;t be restored: an agent needs its own wallet. Remove it and create a new agent.</p>
              )}
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
              {on ? (
                <button
                  type="button"
                  className="btn-line btn-on"
                  style={{ marginTop: 16, width: "100%", height: 50, fontSize: 13, letterSpacing: "0.06em" }}
                  disabled={busy(w.tx, key)}
                  onClick={() => w.run(key, [(s) => call(gw(s), "revoke", [a.agent])], "Revoked. The agent can't play for you any more.")}
                >
                  REVOKE NOW
                </button>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isOwnWallet ? "1fr" : "1fr 1fr", gap: 6, marginTop: 16 }}>
                  {!isOwnWallet && (
                    <button type="button" className="btn-line" style={{ height: 50, fontSize: 12, letterSpacing: "0.06em" }} disabled={busy(w.tx, key)} onClick={() => grant(a.agent, a.maxChipsMUSD, a.maxFloor, a.dailyLossLimitMUSD, 7, key)}>
                      RESTORE PERMISSION
                    </button>
                  )}
                  <button type="button" className="btn-line" style={{ height: 50, fontSize: 12, letterSpacing: "0.06em" }} disabled={removing === a.agent} onClick={() => remove(a.agent)}>
                    {removing === a.agent ? "SIGN IN YOUR WALLET…" : "REMOVE"}
                  </button>
                </div>
              )}
              {removeMsg?.agent === a.agent && <p className={"txnote " + (removeMsg.ok ? "done" : "error")}>{removeMsg.text}</p>}
              <TxNote k={key} wallet={false} />
            </section>
          );
        })}
        <section className="panel" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--fD)", fontWeight: 700, fontSize: 22 }}>+ NEW AGENT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
            <button type="button" className="btn-line" style={{ fontSize: 11 }} aria-pressed={mode === "new"} onClick={() => setMode("new")}>CREATE A NEW AGENT KEY</button>
            <button type="button" className="btn-line" style={{ fontSize: 11 }} aria-pressed={mode === "own"} onClick={() => setMode("own")}>USE MY OWN AGENT WALLET</button>
          </div>
          {mode === "new" ? (
            !gen ? (
              <>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: "12px 0 0", fontFamily: "var(--fB)" }}>
                  Juu makes a new wallet for your agent here in your browser. You get its key once, to put in your MCP client. It is never sent anywhere and never stored.
                </p>
                <button type="button" className="btn-strong" style={{ marginTop: 12, height: 48, fontSize: 13 }} onClick={makeKey}>CREATE AGENT KEY</button>
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em" }}>AGENT ADDRESS</div>
                <div className="mono" style={{ fontSize: 13, overflowWrap: "anywhere", marginTop: 4 }}>{gen.address}</div>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", marginTop: 12 }}>AGENT PRIVATE KEY</div>
                <div className="keybox mono">{gen.privateKey}</div>
                <p className="txnote error" role="alert" style={{ fontWeight: 600 }}>Save this now. It won&apos;t be shown again: Juu doesn&apos;t keep it.</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  <CopyButton text={gen.privateKey} label="COPY KEY" />
                  <button type="button" className="btn-line" style={{ minHeight: 36, padding: "0 12px", fontSize: 11 }} onClick={download}>DOWNLOAD .TXT</button>
                </div>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
                  I saved the key somewhere safe
                </label>
                <label className="check" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={fundGas} onChange={(e) => setFundGas(e.target.checked)} />
                  Also send it {GAS_BTC} BTC for gas
                </label>
              </div>
            )
          ) : (
            <>
              <label htmlFor="agAddr" style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", marginTop: 14 }}>AGENT WALLET ADDRESS</label>
              <input id="agAddr" className="line" style={{ fontSize: 16 }} placeholder="0x…" value={agent} onChange={(e) => setAgent(e.target.value.trim())} autoComplete="off" />
              <p style={{ fontSize: 12, lineHeight: 1.5, margin: "8px 0 0", fontFamily: "var(--fB)" }}>A wallet only your agent uses. You keep its key; Juu never sees it. It needs a little BTC for gas.</p>
            </>
          )}
          {isSelf && <p className="txnote error">That&apos;s the wallet you&apos;re connected with. An agent needs its own wallet.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
            <div>
              <label htmlFor="agMax" style={{ fontSize: 11, letterSpacing: "0.12em" }}>MAX PER BET (MUSD)</label>
              <input id="agMax" className="line" style={{ fontSize: 15 }} value={maxBet} onChange={(e) => setMaxBet(e.target.value)} inputMode="decimal" placeholder="0" />
              <PctButtons balance={myMusd} decimals={2} onPick={setMaxBet} label="MUSD" />
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
          {created && (
            <p className="txnote done">Agent {shortAddr(created.address)} can now play for you on the {stack} stack. Its configs are filled in below{created.key ? "" : " (with a placeholder: use the key you keep)"}.</p>
          )}
        </section>
      </div>
      <ConnectAgent stack={stack} agentKey={created?.key ?? null} user={w.address} />
    </>
  );
}
