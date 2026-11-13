import "@juu/ui/juu.css";
import "./app.css";
import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { StackProvider } from "@/lib/data";
import { MarketProvider } from "@/lib/market";
import { WalletProvider } from "@/lib/wallet";

// Same Google Fonts request as the design system (next/font serves a slightly different Bricolage build).
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "Juu · MUSDash",
  description: "Bitcoin money game on Mezo testnet. Ten floors, Principal and Yield, the Bank and the Principal Market.",
};

// Sets the saved theme before the first paint, so dark mode never flashes light.
const themeScript = `try{var t=localStorage.getItem('juu-theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
