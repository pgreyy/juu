import { FLOORS, amt, collapsePrice, pad2, usd, type LadderRow } from "@juu/ui";

/**
 * The landing hero's ladder preview (sample pools at a sample mark). Five columns that sit tight around the floor:
 * bull values right-aligned, bear values left-aligned. Pool depth bars stay inside their own pool column and grow
 * from the outer edge inward. The app's live ladder is the shared Ladder component; this one is the hero only.
 */
export function HeroLadder({ mark, rows, selected }: { mark: number; rows: LadderRow[]; selected?: number }) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.bullPool, r.bearPool]));
  const depth = (v: number) => (max > 0 ? Math.round((v / max) * 100) : 0) + "%";
  return (
    <div className="hl-box">
      <div className="hl-grid hl-head">
        <span className="r">BULL POOL</span>
        <span className="r">BULL FALLS</span>
        <span className="c">FLOOR</span>
        <span>BEAR FALLS</span>
        <span>BEAR POOL</span>
      </div>
      <div className="hl-mark">
        <span className="k">MARK</span>
        <span className="v">{usd(mark, 2)}</span>
      </div>
      {FLOORS.map((n) => {
        const r = rows.find((x) => x.floor === n) || { floor: n, bullPool: 0, bearPool: 0 };
        return (
          <div key={n} className={"hl-grid hl-row" + (selected === n ? " sel" : "")}>
            <span className="hl-pool bull r">
              <span className="bar" aria-hidden="true" style={{ width: depth(r.bullPool) }} />
              <span className="t">{amt(r.bullPool)}</span>
            </span>
            <span className="bull r">{usd(collapsePrice(mark, n, "Bull"))}</span>
            <span className={"hl-floor c" + (n >= 7 ? " hi" : "")}>{pad2(n)}</span>
            <span className="bear">{usd(collapsePrice(mark, n, "Bear"))}</span>
            <span className="hl-pool bear">
              <span className="bar" aria-hidden="true" style={{ width: depth(r.bearPool) }} />
              <span className="t">{amt(r.bearPool)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
