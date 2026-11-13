import "@juu/ui/juu.css";
import "./app.css";
import type { Metadata } from "next";
import { FONTS_URL, THEME_SCRIPT } from "@juu/ui";
import { Shell } from "@/components/Shell";
import { StackProvider } from "@/lib/data";
import { MarketProvider } from "@/lib/market";
import { WalletProvider } from "@/lib/wallet";


export const metadata: Metadata = {
  title: "Juu · MUSDash",
  description: "Juu, the gamified Bitcoin money layer on Mezo: Doors, Principal and Yield, MUSDash, the Bank and the Principal Market. Live on Mezo testnet.",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Same font request as the design system; next/font serves a slightly different Bricolage build. */}
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
