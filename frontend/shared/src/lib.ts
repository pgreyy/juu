// Shared numbers and geometry for the app and the landing page.

/** Leverage per floor (floor 1 = 1.5x ... floor 10 = 10x), as set on chain. */
export const LEV = [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const FLOORS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
/** Maintenance margin: a floor collapses on a move of 1/leverage minus this. */
export const MM = 0.02;

export type Side = "Bull" | "Bear";

export const lev = (floor: number) => LEV[floor - 1];
export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Price at which a new position on this floor collapses. */
export function collapsePrice(mark: number, floor: number, side: Side, mm = MM) {
  const move = 1 / lev(floor) - mm;
  return side === "Bull" ? mark * (1 - move) : mark * (1 + move);
}

export function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
/** Amounts: whole numbers from 10 up, two decimals below. */
export function amt(n: number) {
  if (n === 0) return "0";
  return Math.abs(n) >= 10 ? fmt(n) : fmt(n, 2);
}
export const usd = (n: number, d = 0) => "$" + fmt(n, d);
/** Signed with a real minus sign: +84.20 / −3.10 */
export function signed(n: number, d = 2) {
  const s = fmt(Math.abs(n), d);
  return n > 0 ? "+" + s : n < 0 ? "−" + s : s;
}
export function pct(n: number, d = 2) {
  return fmt(n * 100, d) + "%";
}
export const shortAddr = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

export type Ray = { deg: number; len: number; w: number; major: boolean };

/** Ray geometry for the starburst: every other ray is a major ray. Same generator as the design reference. */
export function rays(n: number, maxLen: number, seed: number): Ray[] {
  const out: Ray[] = [];
  let x = seed;
  const rnd = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  for (let i = 0; i < n; i++) {
    const deg = (360 / n) * i;
    const major = i % 2 === 0;
    const base = major ? 0.35 + rnd() * 0.65 : 0.85 + rnd() * 0.15;
    out.push({ deg, len: Math.max(2, Math.round(base * maxLen)), w: major ? (maxLen < 20 ? 2 : 3) : 1, major });
  }
  return out;
}
