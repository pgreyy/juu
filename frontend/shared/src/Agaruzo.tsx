import { pad2 } from "./lib";

/** The climb cheer. Show for 1.8 s beside the page title; it never blocks play. */
export function Agaruzo({ floor }: { floor: number }) {
  return (
    <div role="status" className="agaruzo">
      <span className="big">AGARUZO!</span>
      <span className="small">FLOOR {pad2(floor)}</span>
    </div>
  );
}

export function FloorBadge({ floor, width = 84 }: { floor: number | null; width?: number }) {
  return (
    <div className="floor-badge" style={{ flex: `0 0 ${width}px` }}>
      <span className="k">FLOOR</span>
      <span className="n">{floor == null ? "—" : pad2(floor)}</span>
    </div>
  );
}
