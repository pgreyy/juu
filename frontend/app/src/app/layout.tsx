import "@juu/ui/juu.css";
import "./app.css";
import type { Metadata } from "next";
import { FONTS_URL, THEME_SCRIPT } from "@juu/ui";
import { Shell } from "@/components/Shell";
import { StackProvider } from "@/lib/data";
import { MarketProvider } from "@/lib/market";
import { WalletProvider } from "@/lib/wallet";


export const metadata: Metadata = {
  metadataBase: new URL("https://app.playjuu.xyz"),
  title: "Juu · MUSDash",
  description: "Ten floors. How high? Juu, the gamified money layer on Mezo: Doors, Principal and Yield, MUSDash, the Bank and the Principal Market. Live on Mezo testnet.",
  openGraph: {
    title: "Juu · Ten floors. How high?",
    description: "Play MUSDash, swap, save in the Bank or buy Principal on Mezo testnet.",
    url: "https://app.playjuu.xyz",
    siteName: "Juu",
    type: "website",
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Geist and Geist Mono from Google Fonts; Azeret Mono (numbers) is served from /fonts (see @juu/ui/juu.css). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>
        <StackProvider>
          <WalletProvider>
            <MarketProvider>
              <Shell>{children}</Shell>
            </MarketProvider>
          </WalletProvider>
        </StackProvider>
      </body>
    </html>
  );
}
