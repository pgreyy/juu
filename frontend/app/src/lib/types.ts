// Shapes returned by the Juu data API (backend/src/api.js).
export type Pos = {
  id: number; owner: string; player: string; agent: string | null; isAgent: boolean; side: "Bull" | "Bear"; floor: number;
  chip: "MUSD" | "Y" | "P"; seriesId: number | null; size: number; entryPrice: number; openedAt: string;
  chipValue: number | null; pnl: number | null; funding: number | null; equity: number | null; earned: number | null;
  collapsePrice: number | null; collapseDue: boolean | null;
};
export type FloorsRes = { price: number; maintenanceMargin: number; floors: { floor: number; leverage: number; openSize: number; seatPremium: number; positions: { id: number; side: "Bull" | "Bear"; size: number; isAgent: boolean }[] }[] };
export type Series = {
  kind: "veBTC" | "sMUSD"; id: number; endDate: string; phase?: string; btcLocked?: number; pToken: string; yToken: string;
  yMarginValuePerY?: number; pMarginValuePerP?: number; matured?: boolean; principalMUSD?: number;
  pMarket?: { pool: string; btcPerP: number; fixedReturnToEnd: number } | null;
};
export type FeedItem = {
  kind: "open" | "climb" | "drop" | "close" | "collapse" | "jackpot"; id?: number; player: string; isAgent: boolean; agent?: string | null;
  side?: "Bull" | "Bear" | null; floor?: number | null; fromFloor?: number; size?: number; pnl?: number; toSurvivors?: number; prize?: number; time: string; tx: string;
};
export type ClimbRes = { premiumOn: boolean; epochEnds: string; floors: { floor: number; nextSeatPremium: number }[] };
export type BankRes = {
  capitalMUSD: number; liquidityMUSD: number; cashReserve: { targetMUSD: number; share: number; short: boolean }; largestBetSizeNowMUSD: number;
  trove: { collateralBTC: number; debtMUSD: number; collateralRatio: number; target: number };
};
export type JackpotRes = { epoch: number; epochEnds: string; bufferMUSD: number; targetMUSD: number; jackpotNowMUSD: number; recentDraws: { epoch: number; winner: string; prize: number; tx: string }[] };
export type LeaderRes = { ranking: { rank: number; player: string; kind: "human" | "agent"; profitMUSD: number; bestFloor?: number | null; steps?: number; positions?: number }[] };
