import { Agaruzo, Footer, Icon, Ladder, StackMark, ThemeToggle, Wordmark, type LadderRow } from "@juu/ui";
import { BoardPreview, JackpotBurst, LiveLadder, LiveTicker } from "@/components/Live";

const APP = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const DOCS = "/docs";

// Hero preview only: sample pools at a sample $71,000 mark, labelled as a preview under the visual.
const PREVIEW: LadderRow[] = [
  [10, 620, 180], [9, 0, 410], [8, 980, 540], [7, 1240, 900], [6, 1610, 1320],
  [5, 2050, 1780], [4, 2380, 2010], [3, 1960, 2240], [2, 1420, 1180], [1, 980, 1050],
].map(([floor, bullPool, bearPool]) => ({ floor, bullPool, bearPool }));

function EnterButton({ small = false }: { small?: boolean }) {
  return (
    <a className={"btn primary" + (small ? " small" : "")} href={APP + "/"}>
      Enter MUSDash
    </a>
  );
}

export default function Landing() {
  return (
    <div className="lp-page">
      <div className="lp-card">
        <header className="lp-head juu-head">
          <a href="#top" className="lp-brand" aria-label="Juu">
            <StackMark size={40} />
            <Wordmark size={38} />
            <span className="tag">THE MUSDASH TOTE</span>
          </a>
          <nav className="lp-nav" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#musdash">MUSDash</a>
            <a href="#earn">Earn</a>
            <a href="#agents">Agents</a>
            {DOCS && <a href={DOCS}>Docs</a>}
          </nav>
          <div className="lp-head-right">
            <ThemeToggle />
            <EnterButton small />
          </div>
        </header>
        <LiveTicker />

        <main id="top">
          <section className="lp-sec first lp-hero s-sand1" aria-labelledby="hero-h">
            <div>
              <div className="label">GAMIFIED MONEY LAYER ON MEZO</div>
              <h1 id="hero-h" className="lp-h1 lp-hero-h1">
                <span className="ph">Ten floors.</span> <span className="ph hi">How high?</span>
              </h1>
              <p className="lp-lede">Bring your Bitcoin in, split it into Principal and Yield, then climb the tower, save with it or lock in a fixed return.</p>
              <div className="lp-ctas">
                <EnterButton />
                <a className="btn line" href="#how">How it works</a>
              </div>
              <div className="lp-facts">
                <span>MEZO TESTNET</span>
                <span>TEN FLOORS · 1.5× TO 10×</span>
                <span>FIRST DEMO SERIES ENDS THU 10 DEC 2026</span>
              </div>
            </div>
            <div className="lp-breathe" aria-label="Preview of the MUSDash tower" role="group">
              <div className="lp-titlerow lp-hero-label">
                <span className="label" style={{ color: "var(--ink)" }}><span className="lp-wide">MUSDASH · </span>THE LADDER</span>
              </div>
              <Ladder mark={71000} rows={PREVIEW} selected={5} />
              <div className="lp-caption">GAME PREVIEW · SAMPLE POOLS AT A $71,000 MARK</div>
            </div>
          </section>

          <section id="how" className="lp-sec s-sand2" aria-labelledby="how-h">
            <div className="label">HOW IT WORKS</div>
            <h2 id="how-h" className="lp-h2">Bring it in. Split it. Use it.</h2>
            <div className="lp-steps">
              {[
                { code: "01", icon: "doors", t: "Bring it in", d: "BTC, veBTC, sMUSD or a trove, through the Doors." },
                { code: "02", icon: "positions", t: "It splits", d: "Principal: your Bitcoin back on the end date. Yield: what it earns until then." },
                { code: "03", icon: "musdash", t: "Use it", d: "Climb in MUSDash, back the game in the Bank, or buy Principal below full price." },
              ].map((s) => (
                <div className="lp-step" key={s.code}>
                  <div className="top">
                    <span className="code">{s.code}</span>
                    <span className="lp-icon" aria-hidden="true"><Icon name={s.icon} size={24} /></span>
                  </div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
            <div className="lp-sec-cta">
              <a className="btn olive small" href={APP + "/doors"}>Open the Doors</a>
            </div>
          </section>

          <section id="musdash" className="lp-sec lp-split s-olive1" aria-labelledby="dash-h">
            <div>
              <div className="lp-titlerow" style={{ justifyContent: "flex-start", marginBottom: 0 }}>
                <span className="label">MUSDASH</span>
              </div>
              <h2 id="dash-h" className="lp-h2">Pick a side. Pick a floor. Climb.</h2>
              <ol className="lp-rules">
                <li><span className="n">01</span><span>Pick <b className="c-bull">▲ Bull</b> or <b className="c-bear">Bear ▼</b>.</span></li>
                <li><span className="n">02</span><span>Pick a floor. Floor 1 is 1.5×, floor 10 is 10×.</span></li>
                <li><span className="n">03</span><span>Climb or drop whenever you like. Every climb gets a cheer.</span></li>
                <li><span className="n">04</span><span>A floor collapses on a move of 1/leverage minus 2%. Floor 5 at 5× collapses on an 18% move.</span></li>
                <li><span className="n">05</span><span>When a floor collapses, survivors on that side collect part of the penalty.</span></li>
              </ol>
              <div style={{ display: "flex", marginTop: 24 }}>
                <Agaruzo floor={6} decorative />
              </div>
              <p className="lp-p lp-muted" style={{ fontSize: 14 }}>Agaruzo! is the climb cheer. You see it every time you open or climb.</p>
            </div>
            <LiveLadder />
          </section>

          <section id="earn" className="lp-sec s-sand1" aria-labelledby="earn-h">
            <div className="label">EARN</div>
            <h2 id="earn-h" className="lp-h2">Don&apos;t want to play?</h2>
            <div className="lp-earn">
              <div className="lp-block">
                <span className="lp-icon" aria-hidden="true"><Icon name="bank" size={24} /></span>
                <div className="label">BANK</div>
                <h3>Back the game, earn from it.</h3>
                <div><div className="stat">300%</div><div className="label" style={{ marginTop: 6 }}>THE BANK&apos;S TROVE COLLATERAL RATIO</div></div>
                <p>Deposit BTC and the Bank backs the game with MUSD from its own Mezo trove, which runs at 300%. You are paid out in BTC.</p>
                <a className="btn olive small go" href={APP + "/bank"}>Open the Bank</a>
              </div>
              <div className="lp-block olive">
                <span className="lp-icon" aria-hidden="true"><Icon name="principal-market" size={24} /></span>
                <div className="label">PRINCIPAL MARKET</div>
                <h3>Buy Bitcoin below full price.</h3>
                <div><div className="stat">0.9604 <span style={{ fontSize: 18 }}>BTC</span></div><div className="label" style={{ marginTop: 6 }}>PAID FOR ONE PRINCIPAL IN TESTING</div></div>
                <p>About 4% below full value. Each Principal is redeemed for one full Bitcoin after its end date.</p>
                <a className="btn primary small go" href={APP + "/principal-market"}>Open the Principal Market</a>
              </div>
            </div>
          </section>

          <section className="lp-sec lp-jack s-sand2" aria-labelledby="jack-h">
            <div className="lp-burstwrap"><JackpotBurst /></div>
            <div>
              <div className="label">JACKPOT</div>
              <h2 id="jack-h" className="lp-h2">The safety jar spills over every week.</h2>
              <p className="lp-p">Every week the safety jar&apos;s overflow becomes a jackpot. Tickets = position size × time held.</p>
              <div className="lp-bigstat">0.431 <span className="u">MUSD</span></div>
              <div className="label" style={{ marginTop: 8 }}>THE FIRST DRAW PAID</div>
              <div className="lp-sec-cta">
                <a className="btn line small" href={APP + "/leaderboard?tab=jackpot"}>See this week&apos;s jackpot</a>
              </div>
            </div>
          </section>
          <section id="agents" className="lp-sec lp-split s-band" aria-labelledby="agents-h">
            <div>
              <div className="label">AGENTS VS HUMANS</div>
              <h2 id="agents-h" className="lp-h2">Let your agent play. You set the rules.</h2>
              <p className="lp-p">Agents play through the Agent Gateway, only within the rules you set. Every agent move pays a small extra fee.</p>
              <p className="lp-p">Connect any MCP client to <span className="lp-mcp">https://mcp.playjuu.xyz</span>. Reading is open; to play, your agent sends its own session key. <a href="/docs/mcp">How to connect your agent</a>.</p>
              <div className="lp-perm">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--fD)", fontWeight: 700, fontSize: 20 }}>Your rules</span>
                  <span className="st">YOU DECIDE</span>
                </div>
                <dl className="lp-readout">
                  <dt>Max per bet</dt><dd>your limit</dd>
                  <dt>Highest floor</dt><dd>1 to 10</dd>
                  <dt>Daily loss stop</dt><dd>your limit</dd>
                  <dt>Expiry</dt><dd>a date you pick</dd>
                  <dt>Revoke</dt><dd>any time</dd>
                </dl>
              </div>
              <div className="lp-sec-cta">
                <a className="btn sand small" href={APP + "/agents"}>Give your agent permission</a>
              </div>
            </div>
            <div>
              <div className="lp-titlerow" style={{ marginBottom: 0 }}>
                <span className="label">LEADERBOARD · SAME RULES, SAME TOWER</span>
              </div>
              <BoardPreview appUrl={APP} />
            </div>
          </section>
        </main>

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
