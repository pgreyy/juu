import { amt, fmt, pad2, shortAddr, signed, utcWeekday } from "./lib";
import type { TickItem } from "./Ticker";

/** The data API answers the ticker is built from (any may be missing while loading). */
export type TickerInput = {
  price?: number | null;
  change?: number | null;
  sides?: { bull: number; bear: number } | null;
  funding?: { bullPaysPerHour: number; bearPaysPerHour: number } | null;
  jackpot?: { bufferMUSD: number; jackpotNowMUSD: number; epochEnds?: string } | null;
  lastCollapse?: { floor?: number | null; side?: "Bull" | "Bear" | null } | null;
  feedLoaded?: boolean;
  climb?: { premiumOn: boolean; floors: { floor: number; nextSeatPremium: number }[] } | null;
  topAgent?: { player: string; profitMUSD: number } | null;
  agentsLoaded?: boolean;
};

/** "draws Thu": the weekday the current jackpot week ends, from the API (nothing until it arrives). */
function drawDay(iso?: string) {
  if (!iso) return undefined;
  const w = utcWeekday(iso);
  return "draws " + w.charAt(0) + w.slice(1).toLowerCase();
}

/** Ticker items in the design's order. Numbers show 0 until real values arrive; only a name (Top agent) shows a dash. */
export function tickerItems(d: TickerInput): TickItem[] {
  const t: TickItem[] = [];
  t.push({
    label: "BTC / USD",
    value: "$" + fmt(d.price ?? 0, 2),
    sub: d.change == null ? undefined : (d.change >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(d.change) * 100, 2) + "%",
    subTone: d.change == null ? "muted" : d.change >= 0 ? "bull" : "bear",
  });
  const bull = d.sides?.bull ?? 0, bear = d.sides?.bear ?? 0, oi = bull + bear;
  t.push({
    label: "OPEN INTEREST",
    value: amt(oi),
    sub: oi > 0 ? `${Math.round((bull / oi) * 100)}% bull · ${Math.round((bear / oi) * 100)}% bear` : "0% bull · 0% bear",
    burst: { bullShare: oi > 0 ? bull / oi : null },
  });
  t.push({ label: "BULL OPEN", value: amt(bull), tone: "bull" });
  t.push({ label: "BEAR OPEN", value: amt(bear), tone: "bear" });
  const fb = d.funding?.bullPaysPerHour ?? 0, fr = d.funding?.bearPaysPerHour ?? 0;
  t.push({
    label: "FUNDING",
    value: fmt(Math.max(fb, fr, 0) * 100, 4) + "%/h",
    sub: !d.funding ? undefined : fb > 0 ? "bulls pay" : fr > 0 ? "bears pay" : "balanced",
  });
  t.push({ label: "SAFETY JAR", value: amt(d.jackpot?.bufferMUSD ?? 0), sub: "MUSD" });
  t.push({ label: "JACKPOT", value: amt(d.jackpot?.jackpotNowMUSD ?? 0), tone: "hi", sub: drawDay(d.jackpot?.epochEnds) });
  const c = d.lastCollapse;
  if (c) t.push({ label: c.floor ? "FLOOR " + pad2(c.floor) : "COLLAPSE", value: c.side === "Bear" ? "BEARS DOWN" : "BULLS DOWN", tone: "bear" });
  else t.push({ label: "COLLAPSES", value: "0", tone: "muted" });
  const f10 = d.climb?.floors.find((f) => f.floor === 10);
  t.push({ label: "FLOOR 10 PREMIUM", value: d.climb && !d.climb.premiumOn ? "off" : fmt(f10?.nextSeatPremium ?? 0, 2) + " MUSD", tone: "hi" });
  const top = d.topAgent;
  t.push({
    label: "TOP AGENT",
    value: top ? `${shortAddr(top.player)} ${signed(top.profitMUSD)}` : "—",
    tone: top ? (top.profitMUSD >= 0 ? "bull" : "bear") : "muted",
  });
  return t;
}
