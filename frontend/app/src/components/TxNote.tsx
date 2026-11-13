"use client";
import { EXPLORER, useWallet } from "@/lib/wallet";

/**
 * Shows the wallet state for one action (by key): confirm in wallet, waiting, done, or why it failed.
 * Wallet-level messages (no wallet, wrong network) show only where `wallet` is set, so a page shows them once.
 */
export function TxNote({ k, wallet = true }: { k: string | string[]; wallet?: boolean }) {
  const { tx } = useWallet();
  const keys = Array.isArray(k) ? k : [k];
  if (!tx || !(keys.includes(tx.key) || (wallet && tx.key === "wallet"))) return null;
  return (
    <p className={"txnote " + (tx.state === "error" ? "error" : tx.state === "done" ? "done" : "")} role={tx.state === "error" ? "alert" : "status"}>
      {tx.msg}
      {tx.hash && (
        <>
          {" "}
          <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer">View transaction</a>
        </>
      )}
    </p>
  );
}

export function busy(tx: { key: string; state: string } | null, key: string) {
  return Boolean(tx && tx.key === key && (tx.state === "wallet" || tx.state === "pending"));
}
