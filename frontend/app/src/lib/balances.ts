"use client";
import { formatUnits } from "ethers";
import { ABI } from "./abis";
import { ADDR } from "./addresses";
import { useRead } from "./data";
import type { Series } from "./types";
import { read, reader } from "./wallet";

export type SeriesBal = { s: Series; p: number; y: number; earned: { sym: string; v: number }[] };
const REWARD_SYMBOL: Record<string, string> = {
  [ADDR.mezo.btc.toLowerCase()]: "BTC",
  [ADDR.mezo.musd.toLowerCase()]: "MUSD",
  [ADDR.mezo.mezoToken.toLowerCase()]: "MEZO",
};
const n = (x: bigint) => Number(formatUnits(x, 18));

/** The wallet's Principal and Yield in every series, and Yield rewards waiting to be claimed. */
export function useSeriesBalances(address: string | null, series: Series[] | null, bump = 0) {
  return useRead<SeriesBal[]>(
    address && series ? `bal-${address}-${series.length}` : null,
    async () => {
      const splitter = read(ADDR.shared.splitter, ABI.splitter);
      const savings = read(ADDR.shared.savings, ABI.savings);
      const tokens: string[] = await splitter.rewardTokenList();
      return Promise.all(
        series!.map(async (s) => {
          const [p, y] = await Promise.all([read(s.pToken, ABI.erc20).balanceOf(address), read(s.yToken, ABI.erc20).balanceOf(address)]);
          let earned: { sym: string; v: number }[] = [];
          if (s.kind === "veBTC") {
            const vals = await Promise.all(tokens.map((t) => splitter.pendingY(s.id, address, t).catch(() => 0n)));
            earned = tokens.map((t, i) => ({ sym: REWARD_SYMBOL[t.toLowerCase()] || "tokens", v: n(vals[i]) }));
          } else {
            earned = [{ sym: "MUSD", v: n(await savings.pendingY(s.id, address).catch(() => 0n)) }];
          }
          return { s, p: n(p), y: n(y), earned };
        }),
      );
    },
    30000,
    bump,
  );
}

/** The wallet's own BTC (native coin on Mezo), for "you have" checks before a payment. */
export function useBtcBalance(address: string | null, bump = 0) {
  return useRead<number>(address ? `btc-${address}` : null, async () => n(await reader.getBalance(address!)), 20000, bump);
}
