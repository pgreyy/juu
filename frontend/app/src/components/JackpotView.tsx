"use client";
import { Starburst, amt, fmt, shortAddr } from "@juu/ui";
import { usePoll, useStack } from "@/lib/data";
import { until, weekday } from "@/lib/format";
import { useMarket } from "@/lib/market";
import { EXPLORER, useWallet } from "@/lib/wallet";

type Tickets = { yourTickets: number; allTickets: number; yourOdds: number; drawAfter: string; unit: string };

/** The jackpot: pot, countdown, the wallet's tickets and odds, past draws. Shown in Leaderboard's Jackpot tab. */
export function JackpotView() {
  const { stack } = useStack();
  const w = useWallet();
  const m = useMarket();
  const jp = m.jackpot;
  const t = usePoll<Tickets>(w.address ? `/api/${stack}/tickets/${w.address}` : null, 30000, w.bump);
  const all = usePoll<Tickets>(`/api/${stack}/tickets/0x0000000000000000000000000000000000000000`, 60000);
  const bull = m.sides?.bull ?? 0, bear = m.sides?.bear ?? 0;
  const draws = jp?.recentDraws || [];
  const allTickets = t.data?.allTickets ?? all.data?.allTickets;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0, fontFamily: "var(--fN)" }}>
          <div className="label">THIS WEEK&apos;S JACKPOT</div>
          <div style={{ fontSize: 80, lineHeight: 1.05 }} className="c-hi">
            {amt(jp?.jackpotNowMUSD ?? 0)} <span style={{ fontSize: 18 }} className="c-muted">MUSD</span>
          </div>
          <div style={{ fontFamily: "var(--fB)", fontSize: 14 }} className="c-muted">Paid from the safety jar&apos;s overflow</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 26, borderTop: "1.5px solid var(--rule)" }}>
            <div className="stat" style={{ padding: "14px 0" }}><div className="k">DRAW IN</div><div className="v">{jp ? until(jp.epochEnds) : "—"}</div></div>
            <div className="stat" style={{ padding: "14px 0" }}>
              <div className="k">YOUR ODDS</div>
              <div className="v c-bull">{fmt((t.data?.yourOdds ?? 0) * 100, 1) + "%"}</div>
            </div>
            <div className="stat" style={{ padding: "14px 0", borderTop: "1px solid var(--rule2)" }}><div className="k">YOUR TICKETS</div><div className="v">{fmt(t.data?.yourTickets ?? 0)}</div></div>
            <div className="stat" style={{ padding: "14px 0", borderTop: "1px solid var(--rule2)" }}><div className="k">ALL TICKETS</div><div className="v">{fmt(allTickets ?? 0)}</div></div>
          </div>
          <p style={{ fontFamily: "var(--fB)", fontSize: 13 }} className="c-muted">
            Tickets = position size × time held this week. One ticket is 1 MUSD held for one hour.{!w.address && " Connect a wallet to see your tickets."}
          </p>
        </div>
        <div className="jp-burstwrap" style={{ flex: "1 1 420px", minWidth: 0, display: "flex", justifyContent: "center" }}>
          <Starburst big bullShare={bull + bear > 0 ? bull / (bull + bear) : null} label="Ticket chamber. Green rays are the bull share of open positions, red the bear share.">
            <span className="juu-burst-core" style={{ width: 124, height: 124, margin: "-62px 0 0 -62px" }}>
              <span style={{ fontSize: 24 }}>{jp ? weekday(jp.epochEnds) : "THU"}</span>
              <span className="c-muted" style={{ fontSize: 10, letterSpacing: "0.12em" }}>DRAW</span>
            </span>
          </Starburst>
        </div>
      </div>
      <div className="label" style={{ marginTop: 24 }}>PAST WINNERS</div>
      {jp && draws.length === 0 && <div className="empty">No draw yet on this stack. The first draw is after {weekday(jp.epochEnds)} 00:00 UTC.</div>}
      {draws.map((d) => (
        <div key={d.epoch} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--rule2)", fontFamily: "var(--fN)", fontSize: 13 }}>
          <a href={`${EXPLORER}/tx/${d.tx}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Week {d.epoch} · {shortAddr(d.winner)}</a>
          <span className="c-hi">{fmt(d.prize, 3)} MUSD</span>
        </div>
      ))}
    </>
  );
}
