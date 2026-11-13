// Providers, the keeper's signer and contract handles. The keeper key comes from .env (PRIVATE_KEY) and is
// never logged or returned.
import { ethers } from "ethers";
import { ABI } from "./abis.js";
import { addresses, env, RPC_URL, STACKS } from "./config.js";

export const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });

let keeperWallet = null;
export function keeper() {
  if (!keeperWallet) {
    const pk = env("KEEPER_KEY") ?? env("PRIVATE_KEY");
    if (!pk) throw new Error("KEEPER_KEY (or PRIVATE_KEY) missing in .env: the keeper cannot send transactions");
    keeperWallet = new ethers.NonceManager(new ethers.Wallet(pk, provider));
  }
  return keeperWallet;
}

export const c = (address, abi, runner = provider) => new ethers.Contract(address, abi, runner);

export function stack(name) {
  const s = addresses.stacks[name];
  if (!s) throw new Error(`unknown stack '${name}', use one of: ${STACKS.join(", ")}`);
  return {
    name,
    ...s,
    game: c(s.game, ABI.game),
    gateway: c(s.gateway, ABI.gateway),
    bank: c(s.bank, ABI.bank),
    buffer: c(s.buffer, ABI.buffer),
    jackpot: c(s.jackpot, ABI.jackpot),
    pricer: c(s.pricer, ABI.pricer),
    priceFeed: c(s.priceFeed, ABI.priceFeed),
    addr: s,
  };
}

export const shared = {
  splitter: c(addresses.shared.splitter, ABI.splitter),
  savings: c(addresses.shared.savings, ABI.savings),
  pmarket: c(addresses.shared.pmarket, ABI.pmarket),
  voter: c(addresses.mezo.voter, ABI.voter),
  mezoPriceFeed: c(addresses.mezo.priceFeed, ABI.priceFeed),
};

/// Sends a transaction from the keeper with Mezo's gas estimate padded by half (Mezo can underestimate
/// precompile calls). Returns the receipt.
export async function send(contract, fn, args = [], { value } = {}) {
  const signer = keeper();
  const writable = contract.connect(signer);
  const overrides = value ? { value } : {};
  const est = await writable[fn].estimateGas(...args, overrides);
  const tx = await writable[fn](...args, { ...overrides, gasLimit: (est * 3n) / 2n });
  const receipt = await waitReceipt(tx.hash);
  if (receipt.status !== 1) throw new Error(`${fn} reverted in ${tx.hash}`);
  return receipt;
}

/// Mezo's RPC sometimes fails a receipt lookup ("method handler crashed"); poll ourselves and retry.
export async function waitReceipt(hash, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await provider.getTransactionReceipt(hash);
      if (r) return r;
    } catch {}
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error(`no receipt for ${hash} after ${timeoutMs / 1000} s`);
}

export const fmt = (v, d = 18) => Number(ethers.formatUnits(v, d));
export const now = async () => Number((await provider.getBlock("latest")).timestamp);
