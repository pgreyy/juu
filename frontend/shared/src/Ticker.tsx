import { Starburst } from "./Starburst";

export type TickItem = {
  label: string;
  value: string;
  tone?: "ink" | "bull" | "bear" | "hi" | "muted";
  sub?: string;
  subTone?: "bull" | "bear" | "muted";
  burst?: { bullShare: number | null };
};

function Item({ k, dup }: { k: TickItem; dup: boolean }) {
  return (
    <div className="juu-tick-item" aria-hidden={dup || undefined}>
      {k.burst && <Starburst bullShare={k.burst.bullShare} />}
      <span className="juu-tick-label">{k.label}</span>
      <span className={"juu-tick-value c-" + (k.tone || "ink")}>{k.value}</span>
      {k.sub && <span className={"juu-tick-sub c-" + (k.subTone || "muted")}>{k.sub}</span>}
    </div>
  );
}

/** Market ticker: scrolls left in a seamless loop (content twice, 52 s per loop), pauses on hover. */
export function Ticker({ items }: { items: TickItem[] }) {
  return (
    <div className="juu-tickwrap" role="region" aria-label="Market ticker">
      <div className="juu-tick">
        {items.map((k, i) => <Item key={"a" + i} k={k} dup={false} />)}
        {items.map((k, i) => <Item key={"b" + i} k={k} dup={true} />)}
      </div>
    </div>
  );
}
