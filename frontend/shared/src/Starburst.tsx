import type * as React from "react";
import { rays } from "./lib";

const MINI = rays(36, 13, 3);
const BIG = rays(120, 150, 13);

/**
 * Starburst ray chart. Major rays are coloured bull or bear: the bull share of open interest sets how much of the
 * circle is green (an even split matches the design: bull on the left, bear on the right). With nothing open every
 * ray is neutral.
 */
export function Starburst({
  big = false,
  bullShare = null,
  size,
  label,
  children,
}: {
  big?: boolean;
  bullShare?: number | null;
  size?: number;
  label?: string;
  children?: React.ReactNode;
}) {
  const geo = big ? BIG : MINI;
  const inner = big ? 66 : 7;
  const px = size ?? (big ? 440 : 40);
  const split = bullShare == null ? null : bullShare * 360;
  return (
    <span
      className={"juu-burst" + (big ? "" : " juu-burst-mini")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: px, height: px, maxWidth: "100%" }}
    >
      {geo.map((r, i) => {
        // 0deg points down and turns clockwise, so 0 to 180 is the left half.
        const isBull = split != null && ((r.deg > 0 && r.deg < split) || split >= 360);
        const c = !r.major || split == null ? "var(--rMinor)" : isBull ? "var(--rBull)" : "var(--rBear)";
        return (
          <span
            key={i}
            className="ray"
            style={{ width: r.w, height: r.len, background: c, transform: `rotate(${r.deg.toFixed(1)}deg) translateY(${inner}px)` }}
          />
        );
      })}
      {children}
    </span>
  );
}
