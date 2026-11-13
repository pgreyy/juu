"use client";
import { Footer, Icon, StackMark, Ticker, amt, fmt, pad2, shortAddr, signed, type TickItem } from "@juu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { stackAddr, useStack } from "@/lib/data";
import { useMarket } from "@/lib/market";
import { EXPLORER, useWallet } from "@/lib/wallet";

export const TABS = [
  { href: "/", label: "MUSDash", icon: "musdash" },
  { href: "/positions", label: "Positions", icon: "positions" },
  { href: "/doors", label: "Doors", icon: "doors" },
  { href: "/bank", label: "Bank", icon: "bank" },
  { href: "/principal-market", label: "Principal Market", icon: "principal-market" },
  { href: "/jackpot", label: "Jackpot", icon: "jackpot" },
  { href: "/agents", label: "Agents", icon: "agents" },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
];

const NextLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href}>{children}</Link>;

function Rail() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const label = open ? "Collapse sidebar" : "Expand sidebar";
  return (
    <nav aria-label="Main" className={"rail" + (open ? " open" : "")}>
      <button type="button" className="rail-logo" onClick={() => setOpen(!open)} aria-label={label} aria-expanded={open} title={label}>
        <span className="ic-logo"><StackMark size={32} /></span>
        <span className="ic-toggle"><Icon name="sidebar" size={26} /></span>
      </button>
      {TABS.map((t) => {
        const cur = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className="rail-item" aria-current={cur ? "page" : undefined} aria-label={t.label} title={t.label}>
            <span className="dot" aria-hidden="true" />
            <span className="ic" aria-hidden="true"><Icon name={t.icon} /></span>
            {open && <span className="name" aria-hidden="true">{t.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("juu-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button type="button" className="hbtn quiet" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? "LIGHT" : "DARK"}
    </button>
  );
}

function WalletButton() {
  const w = useWallet();
  const text = w.connecting ? "CONNECTING…" : !w.address ? "CONNECT WALLET" : !w.chainOk ? "SWITCH TO MEZO TESTNET" : shortAddr(w.address);
  return (
    <button type="button" className="hbtn" onClick={() => w.connect()} title={w.address || "Connect a wallet on Mezo testnet (chain 31611)"}>
      {text}
    </button>
  );
}

function useTicker(): TickItem[] {
  const m = useMarket();
  const t: TickItem[] = [];
  const price = m.floors?.price;
  t.push({
    label: "BTC / USD",
    value: price ? "$" + fmt(price, 2) : "—",
    sub: m.change == null ? undefined : (m.change >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(m.change) * 100, 2) + "%",
    subTone: m.change == null ? "muted" : m.change >= 0 ? "bull" : "bear",
  });
  const bull = m.sides?.bull ?? 0, bear = m.sides?.bear ?? 0, oi = bull + bear;
  t.push({
    label: "OPEN INTEREST",
    value: m.sides ? amt(oi) : "—",
    sub: oi > 0 ? `${Math.round((bull / oi) * 100)}% bull · ${Math.round((bear / oi) * 100)}% bear` : "nothing open yet",
    burst: { bullShare: oi > 0 ? bull / oi : null },
  });
  t.push({ label: "BULL OPEN", value: m.sides ? amt(bull) : "—", tone: "bull" });
  t.push({ label: "BEAR OPEN", value: m.sides ? amt(bear) : "—", tone: "bear" });
  const fb = m.funding?.bullPaysPerHour ?? 0, fr = m.funding?.bearPaysPerHour ?? 0;
  t.push({
    label: "FUNDING",
    value: m.funding ? fmt(Math.max(fb, fr, 0) * 100, 4) + "%/h" : "—",
    sub: !m.funding ? undefined : fb > 0 ? "bulls pay" : fr > 0 ? "bears pay" : "balanced",
  });
  t.push({ label: "SAFETY JAR", value: m.jackpot ? amt(m.jackpot.bufferMUSD) : "—", sub: "MUSD" });
  t.push({ label: "JACKPOT", value: m.jackpot ? amt(m.jackpot.jackpotNowMUSD) : "—", tone: "hi", sub: "draws Thu" });
  const col = m.feed?.find((f) => f.kind === "collapse");
  if (col) t.push({ label: col.floor ? "FLOOR " + pad2(col.floor) : "COLLAPSE", value: col.side === "Bear" ? "BEARS DOWN" : "BULLS DOWN", tone: "bear" });
  else t.push({ label: "COLLAPSES", value: "none yet", tone: "muted" });
  const f10 = m.climb?.floors.find((f) => f.floor === 10);
  t.push({ label: "FLOOR 10 PREMIUM", value: !m.climb ? "—" : m.climb.premiumOn ? fmt(f10?.nextSeatPremium ?? 0, 2) + " MUSD" : "off", tone: "hi" });
  const top = m.agents?.ranking?.[0];
  t.push({ label: "TOP AGENT", value: top ? `${shortAddr(top.player)} ${signed(top.profitMUSD)}` : "none yet", tone: top ? (top.profitMUSD >= 0 ? "bull" : "bear") : "muted" });
  return t;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { stack } = useStack();
  const ticker = useTicker();
  const m = useMarket();
  const docs = process.env.NEXT_PUBLIC_DOCS_URL || null;
  const net = [
    { label: "Contracts on explorer", href: `${EXPLORER}/address/${stackAddr(stack).game}` },
    { label: "X", href: process.env.NEXT_PUBLIC_X_URL || null },
    { label: "Mezo Discord", href: process.env.NEXT_PUBLIC_MEZO_DISCORD_URL || null },
  ];
  return (
    <div className="page">
      <div className="card">
        <Rail />
        <div className="col">
          <header className="head">
            <Link href="/" className="brand" aria-label="Juu, MUSDash">
              <StackMark size={40} />
              <span className="word">JUU</span>
              <span className="tag">THE MUSDASH TOTE</span>
            </Link>
            <div className="head-right">
              {stack === "demo" && <span className="stack-badge" title="Demo stack: the owner can set the price">DEMO STACK</span>}
              <ThemeToggle />
              <WalletButton />
            </div>
          </header>
          <Ticker items={ticker} />
          <main className="main" id="main">
            {m.apiDown && <p className="txnote error" role="alert">The Juu data API is not answering, so live figures are missing. Start it with: cd backend && npm start</p>}
            {children}
          </main>
          <Footer
            LinkAs={NextLink}
            play={[{ label: "MUSDash", href: "/" }, { label: "Jackpot", href: "/jackpot" }, { label: "Leaderboard", href: "/leaderboard" }, { label: "Agents", href: "/agents" }]}
            earn={[{ label: "Doors", href: "/doors" }, { label: "Positions", href: "/positions" }, { label: "Bank", href: "/bank" }, { label: "Principal Market", href: "/principal-market" }]}
            build={[
              { label: "Docs", href: docs },
              { label: "Data API", href: process.env.NEXT_PUBLIC_DATA_API_URL || null },
              { label: "MCP server", href: docs ? docs.replace(/\/$/, "") + "/agents/mcp" : null },
              { label: "Source on GitHub", href: process.env.NEXT_PUBLIC_SOURCE_URL || null },
            ]}
            network={net}
            right={<span>Live data from Mezo testnet, {stack} stack.</span>}
          />
        </div>
      </div>
    </div>
  );
}
