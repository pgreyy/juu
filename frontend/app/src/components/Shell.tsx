"use client";
import { Footer, Icon, StackMark, THEME_LABEL, ThemeIcon, ThemeToggle, Ticker, Wordmark, shortAddr, tickerItems, useTheme, type ThemeChoice, type TickItem } from "@juu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { stackAddr, useStack } from "@/lib/data";
import { useMarket } from "@/lib/market";
import { EXPLORER, useWallet } from "@/lib/wallet";

export const TABS = [
  { href: "/", label: "MUSDash", icon: "musdash" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/doors", label: "Doors", icon: "doors" },
  { href: "/bank", label: "Bank", icon: "bank" },
  { href: "/principal-market", label: "Principal Market", icon: "principal-market" },
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
          <Link key={t.href} href={t.href} className="rail-item" aria-current={cur ? "page" : undefined} aria-label={t.label} data-tip={t.label}>
            <span className="dot" aria-hidden="true" />
            <span className="ic" aria-hidden="true"><Icon name={t.icon} /></span>
            {open && <span className="name" aria-hidden="true">{t.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function WalletButton() {
  const w = useWallet();
  const [menu, setMenu] = useState(false);
  const open = w.picking || menu;
  const close = () => {
    setMenu(false);
    w.setPicking(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => !(e.target as Element)?.closest?.(".wallet-wrap") && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const text = w.connecting ? "CONNECTING…" : !w.address ? "CONNECT WALLET" : !w.chainOk ? "SWITCH TO MEZO TESTNET" : shortAddr(w.address);
  const click = () => {
    if (w.address && !w.chainOk) return void w.switchNetwork();
    if (w.address || w.wallets.length > 1) return setMenu(!open);
    void w.connect();
  };
  return (
    <div className="wallet-wrap">
      <button
        type="button"
        className="hbtn fill"
        onClick={click}
        aria-haspopup={w.wallets.length > 1 || Boolean(w.address) ? "menu" : undefined}
        aria-expanded={open || undefined}
        title={w.address ? `${w.walletName ?? "Wallet"} · ${w.address}` : "Connect a wallet on Mezo testnet (chain 31611)"}
      >
        <span className="lbl-long">{text}</span>
        <span className="lbl-short">{w.connecting ? "…" : !w.address ? "CONNECT" : !w.chainOk ? "SWITCH" : shortAddr(w.address)}</span>
      </button>
      {open && (
        <div className="wallet-menu" role="menu" aria-label="Choose a wallet">
          <div className="label" style={{ padding: "4px 4px 8px" }}>{w.address ? "CONNECTED · " + (w.walletName ?? "WALLET") : "CHOOSE A WALLET"}</div>
          {w.wallets.length === 0 && <p className="c-muted" style={{ fontSize: 13, margin: 4 }}>No browser wallet found.</p>}
          {w.wallets.map((o) => (
            <button key={o.id} type="button" role="menuitem" className="wallet-opt" onClick={() => { close(); void w.connect(o); }}>
              {o.icon ? <img src={o.icon} alt="" width={24} height={24} /> : <span className="wallet-dot" aria-hidden="true" />}
              <span>{o.name}</span>
            </button>
          ))}
          {w.address && (
            <button type="button" role="menuitem" className="wallet-opt" onClick={() => { close(); w.disconnect(); }}>
              <span className="wallet-dot" aria-hidden="true" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function useTicker(): TickItem[] {
  const m = useMarket();
  return tickerItems({
    price: m.floors?.price,
    change: m.change,
    sides: m.sides,
    funding: m.funding,
    jackpot: m.jackpot,
    lastCollapse: m.feed?.find((f) => f.kind === "collapse") || null,
    feedLoaded: Boolean(m.feed),
    climb: m.climb,
    topAgent: m.agents?.ranking?.[0] || null,
    agentsLoaded: Boolean(m.agents),
  });
}

// Phones (under 768px): a bottom tab bar instead of the sidebar, and a menu for the rest.
const MOBILE_TABS = [
  { href: "/", label: "MUSDash", icon: "musdash" },
  { href: "/doors", label: "Doors", icon: "doors" },
  { href: "/bank", label: "Bank", icon: "bank" },
  { href: "/leaderboard", label: "Leaders", icon: "leaderboard" },
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
];

function MobileTabs() {
  const path = usePathname();
  return (
    <nav className="mtabs" aria-label="Main">
      {MOBILE_TABS.map((t) => {
        const cur = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className="mtab" aria-current={cur ? "page" : undefined}>
            <span className="ic" aria-hidden="true"><Icon name={t.icon} size={22} /></span>
            <span className="nm">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [theme, pickTheme] = useTheme();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: Event) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="mmenu-wrap" ref={wrap}>
      <button type="button" className="hbtn mmenu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <div className="mmenu" role="menu" aria-label="More">
          <Link href="/principal-market" role="menuitem" className="mmenu-item" onClick={close}>
            <Icon name="principal-market" size={20} /> <span>Principal Market</span>
          </Link>
          <Link href="/agents" role="menuitem" className="mmenu-item" onClick={close}>
            <Icon name="agents" size={20} /> <span>Agents</span>
          </Link>
          <a href="https://playjuu.xyz/docs" role="menuitem" className="mmenu-item" onClick={close}>
            <span className="mmenu-doc" aria-hidden="true">?</span> <span>Docs</span>
          </a>
          <div className="mmenu-label">THEME</div>
          <div className="mmenu-theme" role="group" aria-label="Theme">
            {(["light", "dark", "system"] as ThemeChoice[]).map((c) => (
              <button key={c} type="button" role="menuitemradio" aria-checked={theme === c} onClick={() => { pickTheme(c); close(); }}>
                <ThemeIcon c={c} /> <span>{THEME_LABEL[c]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { stack } = useStack();
  const ticker = useTicker();
  const m = useMarket();
  const docs = "https://playjuu.xyz/docs";
  const net = [
    { label: "Contracts on explorer", href: `${EXPLORER}/address/${stackAddr(stack).game}` },
    { label: "X", href: process.env.NEXT_PUBLIC_X_URL || null },
    { label: "Mezo Discord", href: process.env.NEXT_PUBLIC_MEZO_DISCORD_URL || null },
  ];
  return (
    <div className="page">
      <header className="head juu-head">
            <Link href="/" className="brand" aria-label="Juu, MUSDash">
              <StackMark size={40} />
              <Wordmark size={38} />
              <span className="tag">THE MUSDASH TOTE</span>
            </Link>
            <div className="head-right">
              {stack === "demo" && <span className="stack-badge" title="Demo stack: the owner can set the price"><span className="lbl-long">DEMO STACK</span><span className="lbl-short">DEMO</span></span>}
              <span className="desk-only"><ThemeToggle /></span>
              <WalletButton />
              <MobileMenu />
            </div>
      </header>
      <Ticker items={ticker} />
      <div className="frame">
        <Rail />
        <div className="col">
          <main className="main" id="main">
            {m.apiDown && <p className="txnote error" role="alert">The Juu data API is not answering, so live figures are missing. Start it with: cd backend && npm start</p>}
            {children}
          </main>
          <Footer
            LinkAs={NextLink}
            play={[{ label: "MUSDash", href: "/" }, { label: "Jackpot", href: "/leaderboard?tab=jackpot" }, { label: "Leaderboard", href: "/leaderboard" }, { label: "Agents", href: "/agents" }]}
            earn={[{ label: "Doors", href: "/doors" }, { label: "Portfolio", href: "/portfolio" }, { label: "Bank", href: "/bank" }, { label: "Principal Market", href: "/principal-market" }, { label: "Swap", href: "/portfolio?tab=swap" }]}
            build={[
              { label: "Docs", href: docs },
              { label: "Data API", href: docs + "/agents/data-api" },
              { label: "MCP server", href: docs + "/mcp" },
              { label: "Source on GitHub", href: null },
            ]}
            network={net}
            right={<span>Live data from Mezo testnet, {stack} stack.</span>}
          />
        </div>
      </div>
      <MobileTabs />
    </div>
  );
}
