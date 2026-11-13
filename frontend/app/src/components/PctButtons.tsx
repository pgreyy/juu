"use client";

/** BTC kept back by MAX for gas (Mezo gas is tiny, this covers many transactions). */
export const BTC_GAS_RESERVE = 0.00001;

/** Rounds down to `decimals` places, so a filled amount never exceeds the balance. */
const down = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return String(Math.floor(v * f) / f);
};

/**
 * 25% / 50% / 75% / MAX of the user's real balance for the token being entered. `reserve` is kept back (BTC: gas).
 * Disabled when there is no balance (or no wallet).
 */
export function PctButtons({ balance, reserve = 0, decimals = 6, onPick, label = "amount" }: { balance: number | null | undefined; reserve?: number; decimals?: number; onPick: (v: string) => void; label?: string }) {
  const avail = Math.max(0, (balance ?? 0) - reserve);
  return (
    <div className="pct" role="group" aria-label={`Fill ${label} from your balance`}>
      {[25, 50, 75, 100].map((p) => (
        <button key={p} type="button" className="pct-btn" disabled={avail <= 0} onClick={() => onPick(down((avail * p) / 100, decimals))}>
          {p === 100 ? "MAX" : `${p}%`}
        </button>
      ))}
    </div>
  );
}
