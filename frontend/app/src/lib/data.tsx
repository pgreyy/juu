"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ADDR } from "./addresses";

export type StackName = "main" | "demo";
const StackCtx = createContext<{ stack: StackName; setStack: (s: StackName) => void }>({ stack: "main", setStack: () => {} });
export const useStack = () => useContext(StackCtx);
export const stackAddr = (s: StackName) => ADDR.stacks[s];

/** Main stack by default. ?stack=demo (remembered) switches to the demo stack, where the owner can move the price. */
export function StackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStackState] = useState<StackName>("main");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("stack");
    let s: string | null = q;
    try {
      if (q) localStorage.setItem("juu-stack", q);
      else s = localStorage.getItem("juu-stack");
    } catch {}
    if (s === "demo" || s === "main") setStackState(s);
  }, []);
  const setStack = (s: StackName) => {
    try {
      localStorage.setItem("juu-stack", s);
    } catch {}
    setStackState(s);
  };
  return <StackCtx.Provider value={{ stack, setStack }}>{children}</StackCtx.Provider>;
}

/** Polls a Data API path. `null` path = skip. Keeps the last good data while reloading. */
export function usePoll<T>(path: string | null, ms = 15000, bump = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const live = useRef(path);
  live.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const r = await fetch(path, { cache: "no-store" });
      const j = await r.json();
      if (live.current !== path) return;
      if (!r.ok) throw new Error(j.error || r.statusText);
      setData(j as T);
      setError(null);
    } catch (e) {
      if (live.current === path) setError((e as Error).message || "The data API is not answering.");
    } finally {
      if (live.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    setLoading(Boolean(path));
    if (!path) return;
    load();
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [path, ms, load]);

  useEffect(() => {
    if (bump) load();
  }, [bump, load]);

  return { data, error, loading, reload: load };
}

/** Polls an on-chain read. */
export function useRead<T>(key: string | null, fn: () => Promise<T>, ms = 20000, bump = 0) {
  const [data, setData] = useState<T | null>(null);
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    setData(null);
    if (!key) return;
    let stop = false;
    const go = () =>
      f.current().then(
        (v) => !stop && setData(v),
        () => {},
      );
    go();
    const t = setInterval(go, ms);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [key, ms, bump]);
  return data;
}
