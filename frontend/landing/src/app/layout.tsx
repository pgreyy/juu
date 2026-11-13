import "@juu/ui/juu.css";
import "./landing.css";
import { FONTS_URL, THEME_SCRIPT } from "@juu/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://playjuu.xyz"),
  title: "Juu · Ten floors. How high?",
  description:
    "Juu is a gamified Bitcoin money layer on Mezo. Split a BTC position into Principal and Yield, play your Yield in MUSDash, or earn a fixed rate and save in the 300% collateralised Bank. Live on Mezo testnet.",
  openGraph: {
    title: "Juu · Ten floors. How high?",
    description: "A gamified Bitcoin money layer on Mezo: split your BTC into Principal and Yield, climb ten floors in MUSDash, or earn. Live on Mezo testnet.",
    url: "https://playjuu.xyz",
    siteName: "Juu",
    type: "website",
  },
  twitter: { card: "summary", title: "Juu · Ten floors. How high?", description: "A gamified Bitcoin money layer on Mezo. Live on Mezo testnet." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
