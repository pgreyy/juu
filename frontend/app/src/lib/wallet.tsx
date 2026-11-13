"use client";
import { BrowserProvider, Contract, Interface, JsonRpcProvider, type Signer, type TransactionResponse } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ERRORS, ERROR_WORDS } from "./abis";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31611);
export const RPC_URL = process.env.NEXT_PUBLIC_MEZO_RPC || "https://rpc.test.mezo.org";
export const EXPLORER = "https://explorer.test.mezo.org";

/** Read-only connection to Mezo testnet (works without a wallet). */
export const reader = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
export const read = (address: string, abi: readonly string[]) => new Contract(address, abi as string[], reader);

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (...a: unknown[]) => void) => void; removeListener?: (e: string, f: (...a: unknown[]) => void) => void };
const eth = (): Eth | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eth }).ethereum);

export type TxState = { key: string; state: "wallet" | "pending" | "done" | "error"; msg: string; hash?: string };
type Step = (signer: Signer) => Promise<unknown>;

type Wallet = {
  address: string | null;
  chainOk: boolean;
  connecting: boolean;
  connect: () => Promise<string | null>;
  /** Runs wallet steps in order (for example approve, then open). Returns true when all confirmed. */
  run: (key: string, steps: Step[], doneMsg?: string) => Promise<boolean>;
  tx: TxState | null;
  clearTx: () => void;
  bump: number;
};

const Ctx = createContext<Wallet | null>(null);
export const useWallet = () => useContext(Ctx)!;

const errIface = new Interface(ERRORS);

export function explain(e: unknown): string {
  const x = e as { code?: string | number; info?: { error?: { code?: number } }; data?: string; error?: { data?: string }; shortMessage?: string; message?: string; reason?: string };
  if (x?.code === "ACTION_REJECTED" || x?.code === 4001 || x?.info?.error?.code === 4001) return "Cancelled in your wallet.";
  const data = x?.data || x?.error?.data;
  if (typeof data === "string" && data.length >= 10) {
    try {
      const p = errIface.parseError(data);
      if (p) return ERROR_WORDS[p.name] || `The contract refused: ${p.name}.`;
    } catch {}
  }
  const m = x?.shortMessage || x?.reason || x?.message || String(e);
  if (/insufficient funds/i.test(m)) return "Not enough BTC in your wallet for this and its gas.";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
}

/**
 * Sends a contract call the safe way on Mezo: simulate first (Mezo's gas estimate drops the revert reason, the
 * simulation keeps it), then send with 1.5x the estimated gas (Mezo's estimates can run short).
 */
export async function call(c: Contract, fn: string, args: unknown[], overrides: Record<string, unknown> = {}): Promise<TransactionResponse> {
  const f = c.getFunction(fn);
  await f.staticCall(...args, overrides);
  let gasLimit: bigint;
  try {
    gasLimit = ((await f.estimateGas(...args, overrides)) * 3n) / 2n;
  } catch {
    gasLimit = 3_000_000n;
  }
  return f(...args, { ...overrides, gasLimit });
}

async function waitFor(hash: string) {
  // Mezo testnet's RPC sometimes fails a receipt lookup, so poll and retry.
  for (let i = 0; i < 120; i++) {
    try {
      const r = await reader.getTransactionReceipt(hash);
      if (r) return r;
    } catch {}
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error("No receipt after 4 minutes. Check the transaction on the explorer.");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tx, setTx] = useState<TxState | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const e = eth();
    if (!e) return;
    e.request({ method: "eth_accounts" }).then((a) => setAddress(((a as string[])[0] as string) || null)).catch(() => {});
    e.request({ method: "eth_chainId" }).then((c) => setChainId(parseInt(c as string, 16))).catch(() => {});
    const onAcc = (a: unknown) => setAddress(((a as string[])[0] as string) || null);
    const onChain = (c: unknown) => setChainId(parseInt(c as string, 16));
    e.on?.("accountsChanged", onAcc);
    e.on?.("chainChanged", onChain);
    return () => {
      e.removeListener?.("accountsChanged", onAcc);
      e.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const switchChain = useCallback(async () => {
    const e = eth()!;
    const hex = "0x" + CHAIN_ID.toString(16);
    try {
      await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (err) {
      if ((err as { code?: number }).code !== 4902) throw err;
      await e.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hex, chainName: "Mezo Testnet", nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER] }],
      });
    }
    setChainId(CHAIN_ID);
  }, []);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e) {
      setTx({ key: "wallet", state: "error", msg: "No browser wallet found. Install one (for example MetaMask), then connect." });
      return null;
    }
    setConnecting(true);
    try {
      const a = (await e.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(a[0] || null);
      const c = parseInt((await e.request({ method: "eth_chainId" })) as string, 16);
      if (c !== CHAIN_ID) await switchChain();
      return a[0] || null;
    } catch (err) {
      setTx({ key: "wallet", state: "error", msg: explain(err) });
      return null;
    } finally {
      setConnecting(false);
    }
  }, [switchChain]);

  const run = useCallback(
    async (key: string, steps: Step[], doneMsg = "Done.") => {
      try {
        let a = address;
        if (!a || chainId !== CHAIN_ID) a = await connect();
        if (!a) return false;
        const signer = await new BrowserProvider(eth()! as never).getSigner();
        for (let i = 0; i < steps.length; i++) {
          setTx({ key, state: "wallet", msg: steps.length > 1 ? `Confirm step ${i + 1} of ${steps.length} in your wallet.` : "Confirm in your wallet." });
          const t = (await steps[i](signer)) as TransactionResponse | null;
          if (!t) continue;
          setTx({ key, state: "pending", msg: "Waiting for Mezo testnet…", hash: t.hash });
          const r = await waitFor(t.hash);
          if (r.status !== 1) throw new Error("The transaction failed on chain.");
        }
        setTx({ key, state: "done", msg: doneMsg });
        setBump((b) => b + 1);
        return true;
      } catch (err) {
        setTx({ key, state: "error", msg: explain(err) });
        return false;
      }
    },
    [address, chainId, connect],
  );

  const value = useMemo(
    () => ({ address, chainOk: chainId === CHAIN_ID, connecting, connect, run, tx, clearTx: () => setTx(null), bump }),
    [address, chainId, connecting, connect, run, tx, bump],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
