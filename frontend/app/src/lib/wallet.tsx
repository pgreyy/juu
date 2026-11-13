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

/** Any EIP-1193 wallet (MetaMask, Rabby, Coinbase Wallet, OKX, Trust and others). Only standard calls are used. */
type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (...a: unknown[]) => void) => void; removeListener?: (e: string, f: (...a: unknown[]) => void) => void };
/** A wallet found in the browser: announced through EIP-6963, or the single injected window.ethereum as a fallback. */
export type WalletOption = { id: string; name: string; icon: string | null; rdns: string | null; provider: Eth };

// The wallet the user picked. Kept outside React so contract calls can reach it.
let active: Eth | undefined;
const eth = (): Eth | undefined => active;
const injected = (): Eth | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eth }).ethereum);
const PICK_KEY = "juu-wallet";

export type TxState = { key: string; state: "wallet" | "pending" | "done" | "error"; msg: string; hash?: string };
type Step = (signer: Signer) => Promise<unknown>;

type Wallet = {
  address: string | null;
  chainOk: boolean;
  connecting: boolean;
  /** Every wallet found in this browser (EIP-6963), or the injected one. */
  wallets: WalletOption[];
  /** The picker is open (several wallets, none picked yet). */
  picking: boolean;
  setPicking: (open: boolean) => void;
  /** Connect: with a wallet, that one; without, the one already picked, the only one, or open the picker. */
  connect: (choice?: WalletOption) => Promise<string | null>;
  /** Ask the picked wallet to switch to Mezo testnet (adding the network first if it doesn't know it). */
  switchNetwork: () => Promise<boolean>;
  disconnect: () => void;
  walletName: string | null;
  /** Ask the wallet to sign a plain-text message (personal_sign). No transaction, no gas. */
  sign: (message: string) => Promise<string>;
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
  if (/missing revert data/i.test(m)) return "Mezo refused this without giving a reason. Check the amount and your balance, then try again.";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
}

/**
 * Sends a contract call the safe way on Mezo: simulate first (Mezo's gas estimate drops the revert reason, the
 * simulation keeps it), then send with 1.5x the estimated gas (Mezo's estimates can run short).
 */
export async function call(c: Contract, fn: string, args: unknown[], overrides: Record<string, unknown> = {}): Promise<TransactionResponse> {
  const f = c.getFunction(fn);
  try {
    await f.staticCall(...args, overrides);
  } catch (e) {
    // Mezo testnet's RPC now and then fails a call with no reason at all; a real refusal comes back with its reason.
    // Try once more before giving up.
    const err = e as { code?: string; data?: string | null };
    if (err.code !== "CALL_EXCEPTION" || err.data) throw e;
    await new Promise((res) => setTimeout(res, 1500));
    await f.staticCall(...args, overrides);
  }
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

/** True when the wallet says it doesn't know the chain yet (EIP-3326 code 4902, sometimes wrapped). */
function unknownChain(err: unknown) {
  const x = err as { code?: number; data?: { originalError?: { code?: number } }; message?: string };
  return x?.code === 4902 || x?.data?.originalError?.code === 4902 || /unrecognized chain|not been added|unknown chain|wallet_addEthereumChain/i.test(x?.message || "");
}

function networkMessage(err: unknown) {
  const x = err as { code?: number; message?: string };
  if (x?.code === 4001) return "You declined the switch to Mezo testnet. Juu only runs there: click SWITCH TO MEZO TESTNET to try again.";
  if (x?.message === "WRONG_NETWORK") return "Your wallet is still on another network. Switch it to Mezo testnet (chain 31611), or click SWITCH TO MEZO TESTNET.";
  return "Couldn't switch your wallet to Mezo testnet: " + explain(err);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tx, setTx] = useState<TxState | null>(null);
  const [bump, setBump] = useState(0);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [picked, setPicked] = useState<WalletOption | null>(null);
  const [picking, setPicking] = useState(false);

  // EIP-6963: every installed wallet announces itself; ask them to, and listen. If none does within a moment, fall
  // back to the single injected window.ethereum (older wallets).
  useEffect(() => {
    const found = new Map<string, WalletOption>();
    const onAnnounce = (ev: Event) => {
      const d = (ev as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eth }>).detail;
      if (!d?.info || !d.provider) return;
      found.set(d.info.uuid, { id: d.info.uuid, name: d.info.name, icon: d.info.icon || null, rdns: d.info.rdns || null, provider: d.provider });
      setWallets([...found.values()]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = setTimeout(() => {
      const inj = injected();
      if (found.size === 0 && inj) setWallets([{ id: "injected", name: "Browser wallet", icon: null, rdns: null, provider: inj }]);
    }, 600);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);

  // Reconnect quietly to the wallet picked last time (eth_accounts never opens a prompt).
  useEffect(() => {
    if (picked || wallets.length === 0) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PICK_KEY);
    } catch {}
    const w = wallets.find((x) => (x.rdns || x.id) === saved);
    if (!w) return;
    w.provider.request({ method: "eth_accounts" }).then((a) => {
      const acc = ((a as string[])[0] as string) || null;
      if (!acc) return;
      active = w.provider;
      setPicked(w);
      setAddress(acc);
      w.provider.request({ method: "eth_chainId" }).then((c) => setChainId(parseInt(c as string, 16))).catch(() => {});
    }).catch(() => {});
  }, [wallets, picked]);

  // Follow account and network changes in the picked wallet.
  useEffect(() => {
    const e = picked?.provider;
    if (!e) return;
    const onAcc = (a: unknown) => setAddress(((a as string[])[0] as string) || null);
    const onChain = (c: unknown) => setChainId(parseInt(c as string, 16));
    e.on?.("accountsChanged", onAcc);
    e.on?.("chainChanged", onChain);
    return () => {
      e.removeListener?.("accountsChanged", onAcc);
      e.removeListener?.("chainChanged", onChain);
    };
  }, [picked]);

  // Puts the wallet on Mezo testnet: switch, and if the wallet has never seen the network (error 4902), add it with
  // Mezo's published details, then switch. Network details: mezo.org/docs/developers/getting-started (Testnet).
  const switchChain = useCallback(async () => {
    const e = eth()!;
    const hex = "0x" + CHAIN_ID.toString(16);
    const switchTo = () => e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    try {
      await switchTo();
    } catch (err) {
      if (!unknownChain(err)) throw err;
      await e.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: hex, chainName: "Mezo Testnet", nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER] }],
      });
      // Most wallets switch as part of adding; ask again for the ones that don't.
      const now = parseInt((await e.request({ method: "eth_chainId" })) as string, 16);
      if (now !== CHAIN_ID) await switchTo();
    }
    const c = parseInt((await e.request({ method: "eth_chainId" })) as string, 16);
    setChainId(c);
    if (c !== CHAIN_ID) throw new Error("WRONG_NETWORK");
  }, []);

  const connect = useCallback(
    async (choice?: WalletOption) => {
      const w = choice || picked || (wallets.length === 1 ? wallets[0] : null);
      if (!w) {
        if (wallets.length === 0) {
          setTx({ key: "wallet", state: "error", msg: "No browser wallet found. Install one (MetaMask, Rabby, Coinbase Wallet, OKX, Trust or another EVM wallet), then connect." });
        } else {
          setPicking(true);
          setTx({ key: "wallet", state: "wallet", msg: "Pick your wallet at the top of the page." });
        }
        return null;
      }
      setPicking(false);
      active = w.provider;
      setPicked(w);
      try {
        localStorage.setItem(PICK_KEY, w.rdns || w.id);
      } catch {}
      setConnecting(true);
      let step: "connect" | "network" = "connect";
      try {
        const a = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
        setAddress(a[0] || null);
        const c = parseInt((await w.provider.request({ method: "eth_chainId" })) as string, 16);
        setChainId(c);
        step = "network";
        if (c !== CHAIN_ID) await switchChain();
        setTx((t) => (t?.key === "wallet" ? null : t));
        return a[0] || null;
      } catch (err) {
        setTx({ key: "wallet", state: "error", msg: step === "network" ? networkMessage(err) : explain(err) });
        return null;
      } finally {
        setConnecting(false);
      }
    },
    [picked, wallets, switchChain],
  );

  const switchNetwork = useCallback(async () => {
    if (!eth()) return Boolean(await connect());
    try {
      await switchChain();
      setTx((t) => (t?.key === "wallet" ? null : t));
      return true;
    } catch (err) {
      setTx({ key: "wallet", state: "error", msg: networkMessage(err) });
      return false;
    }
  }, [connect, switchChain]);

  const disconnect = useCallback(() => {
    active = undefined;
    setPicked(null);
    setAddress(null);
    setChainId(null);
    try {
      localStorage.removeItem(PICK_KEY);
    } catch {}
  }, []);

  const run = useCallback(
    async (key: string, steps: Step[], doneMsg = "Done.") => {
      try {
        let a = address;
        if (!a || !eth()) a = await connect();
        else if (chainId !== CHAIN_ID && !(await switchNetwork())) return false;
        if (!a) return false;
        const signer = await new BrowserProvider(eth()! as never).getSigner();
        let last: string | undefined;
        for (let i = 0; i < steps.length; i++) {
          setTx({ key, state: "wallet", msg: steps.length > 1 ? `Confirm step ${i + 1} of ${steps.length} in your wallet.` : "Confirm in your wallet." });
          const t = (await steps[i](signer)) as TransactionResponse | null;
          if (!t) continue;
          last = t.hash;
          setTx({ key, state: "pending", msg: "Waiting for Mezo testnet…", hash: t.hash });
          const r = await waitFor(t.hash);
          if (r.status !== 1) throw new Error("The transaction failed on chain.");
        }
        setTx({ key, state: "done", msg: doneMsg, hash: last });
        setBump((b) => b + 1);
        return true;
      } catch (err) {
        setTx({ key, state: "error", msg: explain(err) });
        return false;
      }
    },
    [address, chainId, connect, switchNetwork],
  );

  const value = useMemo(
    () => ({
      address,
      chainOk: chainId === CHAIN_ID,
      connecting,
      wallets,
      picking,
      setPicking,
      connect,
      switchNetwork,
      disconnect,
      walletName: picked?.name ?? null,
      sign: async (message: string) => {
        if (!eth()) throw new Error("Connect a wallet first.");
        return (await new BrowserProvider(eth()! as never).getSigner()).signMessage(message);
      },
      run,
      tx,
      clearTx: () => setTx(null),
      bump,
    }),
    [address, chainId, connecting, wallets, picking, connect, switchNetwork, disconnect, picked, run, tx, bump],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
