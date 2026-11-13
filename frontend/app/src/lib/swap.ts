// Swaps go through Mezo's own basic-pool Router (Mezo's DEX), never a Juu contract. All addresses live here, per chain,
// so mainnet only needs this table filled in. Source: mezo.org/docs/developers/features/mezo-pools (checked 13 Nov 2026).
// BTC is the chain's native coin and also an ERC-20 at 0x7b7c…0000, so routes and approvals use that address.
import { CHAIN_ID } from "./wallet";

export type Sym = "BTC" | "MUSD" | "MEZO";
type SwapConfig = {
  router: string;
  /** Juu's JuuSwap: takes the Juu fee (0.1%) and swaps the rest through `router`, in one transaction. Null = swap
   *  straight through Mezo's Router with no fee. */
  juuSwap: string | null;
  factory: string;
  tokens: Record<Sym, string | null>;
  /** Pools that exist (volatile basic pools), keyed "A/B" in alphabetical order. */
  pools: Partial<Record<"BTC/MUSD" | "MEZO/MUSD", string>>;
};

const CONFIGS: Record<number, SwapConfig> = {
  // Mezo testnet
  31611: {
    router: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
    juuSwap: "0xd562c670179fF0D5aD14660959d8A5c2ec8E83bF",
    factory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
    tokens: {
      BTC: "0x7b7C000000000000000000000000000000000000",
      MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      MEZO: "0x7B7c000000000000000000000000000000000001",
    },
    pools: {
      "BTC/MUSD": "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
      // Not Juu's: an existing MUSD/MEZO volatile pool made through Mezo's PoolFactory (factory pool #36). Thin.
      "MEZO/MUSD": "0x8eb88d745B0aFFF9D71AbC40d7F550Cded7bB342",
    },
  },
  // Mezo mainnet (for later): router, factory and MUSD/BTC pool from Mezo's docs. MEZO's address and pool to be added.
  31612: {
    router: "0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706",
    juuSwap: null, // deploy JuuSwap on mainnet, then set it here
    factory: "0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248",
    tokens: { BTC: "0x7b7C000000000000000000000000000000000000", MUSD: null, MEZO: null },
    pools: { "BTC/MUSD": "0x52e604c44417233b6CcEDDDc0d640A405Caacefb" },
  },
};

export const SWAP = CONFIGS[CHAIN_ID] ?? CONFIGS[31611];
export const SYMS: Sym[] = (["BTC", "MUSD", "MEZO"] as Sym[]).filter((s) => SWAP.tokens[s]);
export const poolKey = (a: Sym, b: Sym) => [a, b].sort().join("/") as "BTC/MUSD" | "MEZO/MUSD";

/** The hops from one token to another: direct if a pool exists, else through MUSD. Null if no route. */
export function route(from: Sym, to: Sym): { from: Sym; to: Sym; pool: string }[] | null {
  if (from === to) return null;
  const direct = SWAP.pools[poolKey(from, to)];
  if (direct) return [{ from, to, pool: direct }];
  const a = SWAP.pools[poolKey(from, "MUSD")], b = SWAP.pools[poolKey("MUSD", to)];
  return a && b ? [{ from, to: "MUSD", pool: a }, { from: "MUSD", to, pool: b }] : null;
}

export const ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[])",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[])",
];
export const JUUSWAP_ABI = [
  "function feeRate() view returns (uint256)",
  "function feeOn() view returns (bool)",
  "function quote(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256 fee, uint256 amountOut)",
  "function swap(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256)",
];
export const POOL_ABI = ["function token0() view returns (address)", "function getReserves() view returns (uint256, uint256, uint256)"];
