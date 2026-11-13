import type * as React from "react";
import { StackMark } from "./Logo";

export type FootLink = { label: string; href?: string | null };
type LinkComp = React.ComponentType<{ href: string; children: React.ReactNode }>;

/** The app footer, shared by the app and the landing page. Links without a URL show as plain text. */
export function Footer({
  play,
  earn,
  build,
  network,
  right,
  LinkAs,
}: {
  play: FootLink[];
  earn: FootLink[];
  build: FootLink[];
  network: FootLink[];
  right?: React.ReactNode;
  LinkAs?: LinkComp;
}) {
  const cols: { title: string; links: FootLink[]; note?: string }[] = [
    { title: "Play", links: play },
    { title: "Earn", links: earn },
    { title: "Build", links: build },
    { title: "On the network", links: network, note: "Runs on Mezo testnet (matsnet)." },
  ];
  const L = (lk: FootLink) => {
    if (!lk.href) return <span className="plain" title="Not published yet">{lk.label}</span>;
    const external = /^https?:/.test(lk.href);
    if (LinkAs && !external) return <LinkAs href={lk.href}>{lk.label}</LinkAs>;
    return (
      <a href={lk.href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {lk.label}
      </a>
    );
  };
  return (
    <footer className="juu-footer">
      <div className="juu-footer-cols">
        <div className="juu-footer-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StackMark size={40} />
            <span className="name">Juu</span>
          </div>
          <p>Bring your Bitcoin positions in, split them into Principal and Yield, then play them, save with them or lock in a fixed return.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title} className="juu-footer-col">
            <div className="t">{c.title}</div>
            <ul>
              {c.links.map((lk) => (
                <li key={lk.label}>{L(lk)}</li>
              ))}
            </ul>
            {c.note && <p className="note">{c.note}</p>}
          </div>
        ))}
      </div>
      <div className="juu-footer-bar">
        <span>Mezo testnet only. No mainnet contracts yet.</span>
        {right}
      </div>
    </footer>
  );
}
