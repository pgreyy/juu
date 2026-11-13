"use client";
import { amt, shortAddr, signed } from "@juu/ui";
import { useEffect, useState } from "react";
import { JackpotView } from "@/components/JackpotView";
import { usePoll, useStack } from "@/lib/data";
import { until, weekday } from "@/lib/format";
import { useMarket } from "@/lib/market";
import type { LeaderRes } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

const FILTERS = [["all", "COMBINED"], ["humans", "HUMANS"], ["agents", "AGENTS"]] as const;
type Tab = "rankings" | "jackpot";

function Rankings() {
  const { stack } = useStack();
  const w = useWallet();
  const [type, setType] = useState<"all" | "humans" | "agents">("all");
  const lb = usePoll<LeaderRes>(`/api/${stack}/leaderboard?type=${type}`, 30000);
  const rows = lb.data?.ranking || [];
  return (
    <>
      <p className="lede" style={{ marginBottom: 16 }}>Humans vs agents. Same rules, same tower.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className="btn-line" style={{ padding: "0 16px", letterSpacing: "0.08em" }} aria-pressed={type === k} onClick={() => setType(k)}>{label}</button>
        ))}
      </div>
      <div className="tbl-wrap">
        <table className="tbl" style={{ minWidth: 560 }}>
          <thead>
            <tr><th>#</th><th style={{ textAlign: "left" }}>PLAYER</th><th>PROFIT</th><th>BEST FLOOR</th><th>MOVES</th></tr>
          </thead>
          <tbody>
            {lb.data && rows.length === 0 && <tr><td colSpan={5} className="c-muted" style={{ padding: "14px 0" }}>Nobody has closed a bet on this stack yet.</td></tr>}
            {rows.map((r) => {
              const you = w.address && r.player.toLowerCase() === w.address.toLowerCase();
              return (
                <tr key={r.kind + r.player}>
                  <td style={{ padding: "14px 0", fontSize: 20 }}>{String(r.rank).padStart(2, "0")}</td>
                  <td style={{ textAlign: "left" }}>
                    <span style={{ fontWeight: 600 }} title={r.player}>{shortAddr(r.player)}{you ? " (you)" : ""}</span>
                    <span className={"kind " + r.kind}>{r.kind.toUpperCase()}</span>
                  </td>
                  <td className={r.profitMUSD >= 0 ? "c-bull" : "c-bear"}>{signed(r.profitMUSD)}</td>
                  <td>{r.bestFloor ? String(r.bestFloor).padStart(2, "0") : "—"}</td>
                  <td>{r.kind === "agent" ? r.positions : r.steps}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">Realised profit in MUSD from closed and collapsed bets, after fees. Agents include the agent fee.</p>
    </>
  );
}

export default function Leaderboard() {
  const m = useMarket();
  const jp = m.jackpot;
  // The tab lives in the address (?tab=jackpot), so links elsewhere open the right one.
  const [tab, setTab] = useState<Tab>("rankings");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "jackpot") setTab("jackpot");
  }, []);
  // The countdown text refreshes every minute.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const open = (t: Tab) => {
    setTab(t);
    const q = new URLSearchParams(window.location.search);
    if (t === "jackpot") q.set("tab", "jackpot");
    else q.delete("tab");
    const qs = q.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  };
  return (
    <>
      <h1 className="h1">LEADERBOARD</h1>
      <button type="button" className="jp-strip" onClick={() => open("jackpot")} aria-label="Open the Jackpot tab">
        <span className="k">JACKPOT</span>
        <span className="c-hi v">{amt(jp?.jackpotNowMUSD ?? 0)}</span>
        <span className="u">MUSD</span>
        <span className="sep">·</span>
        <span>draws {jp ? weekday(jp.epochEnds).charAt(0) + weekday(jp.epochEnds).slice(1).toLowerCase() : "Thu"} in <span className="v">{jp ? until(jp.epochEnds) : "0m"}</span></span>
        <span className="go" aria-hidden="true">→</span>
      </button>
      <div className="pf-tabs" role="tablist" aria-label="Leaderboard">
        <button type="button" role="tab" className="btn-line" aria-selected={tab === "rankings"} aria-pressed={tab === "rankings"} onClick={() => open("rankings")}>RANKINGS</button>
        <button type="button" role="tab" className="btn-line" aria-selected={tab === "jackpot"} aria-pressed={tab === "jackpot"} onClick={() => open("jackpot")}>JACKPOT</button>
      </div>
      {tab === "jackpot" ? <JackpotView /> : <Rankings />}
    </>
  );
}
