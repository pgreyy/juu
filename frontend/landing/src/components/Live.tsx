"use client";
// Live parts of the landing page: they read the Juu data API (main stack) and show a dash while loading.
import { Ladder, Starburst, Ticker, collapsePrice, fmt, lev, pad2, shortAddr, signed, tickerItems, usd, utcLongDate, utcWeekday, type LadderRow } from "@juu/ui";
import { useEffect, useState } from "react";
import { HeroLadder } from "./HeroLadder";

function useJson<T>(path: string, ms = 30000) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let stop = false;
    const go = () =>
      fetch(path, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => !stop && j && setData(j))
        .catch(() => {});
    go();
    const t = setInterval(go, ms);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [path, ms]);
  return data;
}

type Floors = { price: number; floors: { floor: number; positions: { side: "Bull" | "Bear"; size: number }[] }[] };
type Sides = { bull: number; bear: number };

export function LiveTicker() {
  const floors = useJson<Floors>("/api/main/floors");
  const hist = useJson<{ samples: { price: number }[] }>("/api/main/price/history?minutes=1440", 60000);
  const sides = useJson<Sides>("/api/main/sides");
  const funding = useJson<{ bullPaysPerHour: number; bearPaysPerHour: number }>("/api/main/funding", 60000);
  const jackpot = useJson<{ bufferMUSD: number; jackpotNowMUSD: number; epochEnds: string }>("/api/main/jackpot");
  const feed = useJson<{ feed: { kind: string; floor?: number | null; side?: "Bull" | "Bear" | null }[] }>("/api/main/feed?limit=20");
  const climb = useJson<{ premiumOn: boolean; floors: { floor: number; nextSeatPremium: number }[] }>("/api/main/climb-premium");
  const agents = useJson<{ ranking: { player: string; profitMUSD: number }[] }>("/api/main/leaderboard?type=agents", 60000);
  const first = hist?.samples?.[0]?.price;
  return (
    <Ticker
      items={tickerItems({
        price: floors?.price,
        change: first && floors?.price ? (floors.price - first) / first : null,
        sides,
        funding,
        jackpot,
        lastCollapse: feed?.feed.find((f) => f.kind === "collapse") || null,
        feedLoaded: Boolean(feed),
        climb,
        topAgent: agents?.ranking?.[0] || null,
        agentsLoaded: Boolean(agents),
      })}
    />
  );
}

/** The real tower: live mark price and pools from the main stack. Pick a floor to see its numbers. */
export function LiveLadder() {
  const data = useJson<Floors>("/api/main/floors", 15000);
  const [floor, setFloor] = useState(5);
  const rows: LadderRow[] = (data?.floors || []).map((f) => ({
    floor: f.floor,
    bullPool: f.positions.filter((p) => p.side === "Bull").reduce((s, p) => s + p.size, 0),
    bearPool: f.positions.filter((p) => p.side === "Bear").reduce((s, p) => s + p.size, 0),
  }));
  const mark = data?.price ?? null;
  const move = 1 / lev(floor) - 0.02;
  return (
    <div>
      <Ladder mark={mark} rows={rows} selected={floor} onPick={setFloor} />
      <div className="lp-caption">
        LIVE FROM MEZO TESTNET · CLICK A FLOOR{data && rows.every((r) => r.bullPool === 0 && r.bearPool === 0) ? " · NO OPEN POSITIONS RIGHT NOW" : ""}
      </div>
      <dl className="lp-readout" aria-live="polite">
        <dt>Floor</dt><dd>{pad2(floor)}</dd>
        <dt>Leverage</dt><dd>{lev(floor)}×</dd>
        <dt>Collapses on a move of</dt><dd>{fmt(move * 100, 1)}%</dd>
        <dt>A new Bull collapses at</dt><dd className="c-bear">{mark == null ? "—" : usd(collapsePrice(mark, floor, "Bull"))}</dd>
        <dt>A new Bear collapses at</dt><dd className="c-bear">{mark == null ? "—" : usd(collapsePrice(mark, floor, "Bear"))}</dd>
      </dl>
    </div>
  );
}

/** Top of the real leaderboard (main stack), humans and agents together. */
export function BoardPreview({ appUrl }: { appUrl: string }) {
  const lb = useJson<{ ranking: { rank: number; player: string; kind: "human" | "agent"; profitMUSD: number }[] }>("/api/main/leaderboard?type=all", 60000);
  const rows = (lb?.ranking || []).slice(0, 5);
  return (
    <div>
      <table className="lp-board">
        <caption className="sr-only">Leaderboard, top five</caption>
        <thead>
          <tr><th>#</th><th>PLAYER</th><th>PROFIT (MUSD)</th></tr>
        </thead>
        <tbody>
          {!lb && <tr><td colSpan={3} className="c-muted">Loading the leaderboard…</td></tr>}
          {lb && rows.length === 0 && <tr><td colSpan={3} className="c-muted">No closed bets yet. Be the first.</td></tr>}
          {rows.map((r) => (
            <tr key={r.kind + r.player}>
              <td>{pad2(r.rank)}</td>
              <td><span style={{ fontWeight: 500 }}>{shortAddr(r.player)}</span><span className={"kind " + r.kind}>{r.kind.toUpperCase()}</span></td>
              <td className={r.profitMUSD >= 0 ? "c-bull" : "c-bear"}>{signed(r.profitMUSD)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {lb && !(lb.ranking || []).some((r) => r.kind === "agent") && rows.length > 0 && <p className="lp-caption" style={{ marginTop: 10 }}>NO AGENT HAS CLOSED A BET YET</p>}
      <div className="lp-caption" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span><span className="kind human" style={{ marginLeft: 0 }}>HUMAN</span> a person</span>
        <span><span className="kind agent" style={{ marginLeft: 0 }}>AGENT</span> plays under its owner&apos;s rules</span>
      </div>
      <div className="lp-caption">LIVE FROM MEZO TESTNET · <a href={appUrl + "/leaderboard"} style={{ color: "inherit" }}>FULL LEADERBOARD</a></div>
    </div>
  );
}

/** The ticket chamber. Green and red follow the live bull and bear split; an even split while nothing is open. */
export function JackpotBurst() {
  const sides = useJson<Sides>("/api/main/sides");
  const jp = useJson<{ epochEnds: string }>("/api/main/jackpot", 60000);
  const oi = sides ? sides.bull + sides.bear : 0;
  return (
    <Starburst big bullShare={oi > 0 ? sides!.bull / oi : 0.5} label="The jackpot ticket chamber">
      <span className="juu-burst-core" style={{ width: 124, height: 124, margin: "-62px 0 0 -62px" }}>
        <span style={{ fontSize: 24 }}>{jp?.epochEnds ? utcWeekday(jp.epochEnds) : "—"}</span>
        <span className="c-muted" style={{ fontSize: 10, letterSpacing: "0.12em" }}>DRAW</span>
      </span>
    </Starburst>
  );
}

// The demo series (series 0) keeps its own wording while it is the next one to end.
const DEMO_SERIES_END = "2026-12-10";

/**
 * Hero fact: the soonest series end date that hasn't passed yet (chain time, from /api/series), for example
 * "NEXT SERIES ENDS THU 31 DEC 2026". Renders nothing while loading or when no future series exists, so the
 * line keeps no dangling dot.
 */
export function NextSeriesFact() {
  const data = useJson<{ now: string; series: { endDate: string }[] }>("/api/series", 300000);
  if (!data?.series) return null;
  const now = Date.parse(data.now) || Date.now();
  const next = data.series.map((s) => s.endDate).filter((d) => Date.parse(d) > now).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  if (!next) return null;
  const label = next.startsWith(DEMO_SERIES_END) ? "FIRST DEMO SERIES ENDS" : "NEXT SERIES ENDS";
  return <span>{label} {utcLongDate(next)}</span>;
}

/** Hero ladder preview: sample pools, marked at the live BTC price (Mezo's price feed, main stack) with its 24 h change. */
export function LiveHeroLadder({ rows, selected }: { rows: LadderRow[]; selected?: number }) {
  const floors = useJson<Floors>("/api/main/floors");
  const hist = useJson<{ samples: { price: number }[] }>("/api/main/price/history?minutes=1440", 60000);
  const mark = floors?.price ?? null;
  const first = hist?.samples?.[0]?.price;
  const change = mark != null && first ? mark / first - 1 : null;
  return <HeroLadder mark={mark} change={change} rows={rows} selected={selected} />;
}
