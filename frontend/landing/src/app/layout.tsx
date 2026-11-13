import "@juu/ui/juu.css";
import "./landing.css";
import { FONTS_URL, THEME_SCRIPT } from "@juu/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Juu · Bitcoin money game on Mezo",
  description: "Bring your Bitcoin in, split it into Principal and Yield, then climb the tower, save with it or lock in a fixed return. Mezo testnet.",
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
