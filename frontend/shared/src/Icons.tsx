import type * as React from "react";
// The page icons and the sidebar icon (docs/design/assets/icons). 24px grid, stroke 1.8, round caps.
const PATHS: Record<string, React.ReactNode> = {
  musdash: <path d="M6 21V7l6-4 6 4v14M6 11h12M6 15h12M10 21v-3h4v3" />,
  positions: <path d="M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5" />,
  portfolio: <path d="M11 4a8 8 0 1 0 9 9h-9V4zM14 2.5a8 8 0 0 1 7.5 7.5H14V2.5z" />,
  doors: <path d="M6 21V3h10v18M3 21h18M13 12h.01" />,
  bank: <path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />,
  "principal-market": (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  jackpot: <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9.5 17h5" />,
  agents: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5" />
    </>
  ),
  leaderboard: <path d="M3 21v-7h6v7M9 21V9h6v12M15 21v-5h6v5M3 21h18" />,
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
