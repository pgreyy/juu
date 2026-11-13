import { Footer, StackMark, ThemeToggle, Wordmark } from "@juu/ui";
import Link from "next/link";
import { DocNav } from "@/components/DocNav";
import { nav } from "@/lib/docs";

const APP = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const sections = nav();
  return (
    <div className="lp-page">
      <div className="lp-card">
        <header className="lp-head juu-head">
          <Link href="/" className="lp-brand" aria-label="Juu home">
            <StackMark size={40} />
            <Wordmark size={38} />
            <span className="tag">DOCS</span>
          </Link>
          <nav className="lp-nav" aria-label="Sections">
            <Link href="/docs">Docs home</Link>
            <Link href="/docs/mcp">MCP</Link>
            <Link href="/docs/agents/data-api">Data API</Link>
            <Link href="/">Home</Link>
          </nav>
          <div className="lp-head-right">
            <ThemeToggle />
            <a className="btn primary small" href={APP + "/"}>Enter MUSDash</a>
          </div>
        </header>
        <div className="doc-wrap s-sand1">
          <DocNav sections={sections} />
          <main className="doc-main" id="main">{children}</main>
        </div>
        <Footer
          play={[{ label: "MUSDash", href: APP + "/" }, { label: "Jackpot", href: APP + "/leaderboard?tab=jackpot" }, { label: "Leaderboard", href: APP + "/leaderboard" }, { label: "Agents", href: APP + "/agents" }]}
          earn={[{ label: "Doors", href: APP + "/doors" }, { label: "Portfolio", href: APP + "/portfolio" }, { label: "Bank", href: APP + "/bank" }, { label: "Principal Market", href: APP + "/principal-market" }]}
          build={[
            { label: "Docs", href: "/docs" },
            { label: "Data API", href: "/docs/agents/data-api" },
            { label: "MCP server", href: "/docs/mcp" },
            { label: "Source on GitHub", href: null },
          ]}
          network={[
            { label: "Contracts on explorer", href: "https://explorer.test.mezo.org/address/0xb86Ef40aB59dFbc9fAE812Bc379D248DB3D6Defd" },
            { label: "X", href: process.env.NEXT_PUBLIC_X_URL || null },
            { label: "Mezo Discord", href: process.env.NEXT_PUBLIC_MEZO_DISCORD_URL || null },
          ]}
        />
      </div>
    </div>
  );
}
