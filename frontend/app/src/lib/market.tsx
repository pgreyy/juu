"use client";
import { createContext, useContext } from "react";
import { usePoll, useStack } from "./data";
import type { ClimbRes, FeedItem, FloorsRes, JackpotRes, LeaderRes, Series } from "./types";
import { useWallet } from "./wallet";

type Market = {
  floors: FloorsRes | null;
  change: number | null;
  sides: { bull: number; bear: number } | null;
  funding: { bullPaysPerHour: number; bearPaysPerHour: number } | null;
  jackpot: JackpotRes | null;
  feed: FeedItem[] | null;
  climb: ClimbRes | null;
  agents: LeaderRes | null;
  series: Series[] | null;
  apiDown: boolean;
};
const Ctx = createContext<Market | null>(null);
export const useMarket = () => useContext(Ctx)!;

/** Shared live market data for the ticker and the pages (polled from the data API). */
export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { stack } = useStack();
  const { bump } = useWallet();
  const floors = usePoll<FloorsRes>(`/api/${stack}/floors`, 10000, bump);
  const hist = usePoll<{ samples: { t: number; price: number }[] }>(`/api/${stack}/price/history?minutes=1440`, 60000);
  const sides = usePoll<{ bull: number; bear: number }>(`/api/${stack}/sides`, 15000, bump);
  const funding = usePoll<{ bullPaysPerHour: number; bearPaysPerHour: number }>(`/api/${stack}/funding`, 60000);
  const jackpot = usePoll<JackpotRes>(`/api/${stack}/jackpot`, 30000, bump);
  const feed = usePoll<{ feed: FeedItem[] }>(`/api/${stack}/feed?limit=20`, 10000, bump);
  const climb = usePoll<ClimbRes>(`/api/${stack}/climb-premium`, 30000, bump);
  const agents = usePoll<LeaderRes>(`/api/${stack}/leaderboard?type=agents`, 60000);
  const series = usePoll<{ series: Series[] }>(`/api/series`, 60000, bump);
  const first = hist.data?.samples?.[0]?.price;
  const price = floors.data?.price;
  return (
    <Ctx.Provider
      value={{
        floors: floors.data,
        change: first && price ? (price - first) / first : null,
        sides: sides.data,
        funding: funding.data,
        jackpot: jackpot.data,
        feed: feed.data?.feed ?? null,
        climb: climb.data,
        agents: agents.data,
        series: series.data?.series ?? null,
        apiDown: Boolean(floors.error && !floors.data),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
