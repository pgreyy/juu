import { FLOORS, amt, collapsePrice, fmt, pad2, usd } from "./lib";

export type LadderRow = { floor: number; bullPool: number; bearPool: number };

/**
 * The Ladder: order-book view of the ten floors. Floor 10 at the top, the MARK bar on top, pool depth shaded behind
 * each row (bull from the left, bear from the right, 18% opacity). Collapse prices are for a new position at the mark.
 */
export function Ladder({
  mark,
  change,
  rows,
  selected,
  onPick,
  floors = FLOORS,
  flash,
}: {
  mark: number | null;
  change?: number | null;
  rows: LadderRow[];
  selected?: number;
  onPick?: (floor: number) => void;
  floors?: number[];
  flash?: number | null;
}) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.bullPool, r.bearPool]));
  const depth = (v: number) => (max > 0 ? Math.round((v / max) * 48) : 0) + "%";
  return (
    <div className="ladder">
      <div className="ladder-grid ladder-head">
        <span>BULL POOL</span>
        <span style={{ textAlign: "right" }}>BULL FALLS AT</span>
        <span style={{ textAlign: "center" }}>FLOOR</span>
        <span>BEAR FALLS AT</span>
        <span style={{ textAlign: "right" }}>BEAR POOL</span>
      </div>
      <div className="ladder-mark">
        <span className="k">MARK</span>
        <span className="v">{mark == null ? "—" : usd(mark, 2)}</span>
        {change != null && <span className="d">{(change >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(change) * 100, 2) + "%"}</span>}
      </div>
      {floors.map((n) => {
        const r = rows.find((x) => x.floor === n) || { floor: n, bullPool: 0, bearPool: 0 };
        const Tag = onPick ? "button" : "div";
        return (
          <Tag
            key={n}
            {...(onPick ? { type: "button" as const, onClick: () => onPick(n), "aria-pressed": selected === n, "aria-label": `Pick floor ${n}` } : {})}
            className={"ladder-row ladder-grid" + (flash === n ? " flash" : "")}
            style={!onPick && selected === n ? { background: "var(--sel)" } : undefined}
          >
            <span className="depth bull" aria-hidden="true" style={{ width: depth(r.bullPool) }} />
            <span className="depth bear" aria-hidden="true" style={{ width: depth(r.bearPool) }} />
            <span className="c-bull">{amt(r.bullPool)}</span>
            <span className="r c-bull">{mark == null ? "—" : usd(collapsePrice(mark, n, "Bull"))}</span>
            <span className={"num " + (n >= 7 ? "c-hi" : "c-ink")}>{pad2(n)}</span>
            <span className="c-bear">{mark == null ? "—" : usd(collapsePrice(mark, n, "Bear"))}</span>
            <span className="r c-bear">{amt(r.bearPool)}</span>
          </Tag>
        );
      })}
    </div>
  );
}
