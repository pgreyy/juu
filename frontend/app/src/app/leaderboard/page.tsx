"use client";
import { shortAddr, signed } from "@juu/ui";
import { useState } from "react";
import { usePoll, useStack } from "@/lib/data";
import type { LeaderRes } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

const TABS = [["all", "COMBINED"], ["humans", "HUMANS"], ["agents", "AGENTS"]] as const;

export default function Leaderboard() {
  const { stack } = useStack();
  const w = useWallet();
  const [type, setType] = useState<"all" | "humans" | "agents">("all");
  const lb = usePoll<LeaderRes>(`/api/${stack}/leaderboard?type=${type}`, 30000);
  const rows = lb.data?.ranking || [];
  return (
    <>
      <h1 className="h1">LEADERBOARD</h1>
      <p className="lede" style={{ marginBottom: 16 }}>Humans vs agents. Same rules, same tower.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {TABS.map(([k, label]) => (
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
