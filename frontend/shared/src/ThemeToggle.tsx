"use client";
import { useEffect, useRef, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "juu-theme";
const LABEL: Record<Choice, string> = { light: "Light", dark: "Dark", system: "System" };

function ThemeIcon({ c }: { c: Choice }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (c === "light")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (c === "dark")
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

const systemDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
function apply(c: Choice) {
  const dark = c === "dark" || (c === "system" && systemDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function saved(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

/** The theme choice (Light / Dark / System), remembered in this browser; System follows the device, live. */
export function useTheme(): [Choice, (c: Choice) => void] {
  const [choice, setChoice] = useState<Choice>("system");
  useEffect(() => setChoice(saved()), []);
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);
  const pick = (c: Choice) => {
    setChoice(c);
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {}
    apply(c);
  };
  return [choice, pick];
}

export { ThemeIcon, LABEL as THEME_LABEL };
export type { Choice as ThemeChoice };

/**
 * Theme button: icon only, opens Light / Dark / System. System (the default for new visitors) follows the device
 * setting, live. The choice is remembered in this browser; the head script applies it before the first paint.
 */
export function ThemeToggle({ className = "hbtn quiet" }: { className?: string }) {
  const [choice, pickTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const pick = (c: Choice) => {
    setOpen(false);
    pickTheme(c);
  };

  return (
    <div className="theme-wrap" ref={wrap}>
      <button
        type="button"
        className={className + " theme-btn"}
        onClick={() => setOpen(!open)}
        aria-label={`Theme: ${LABEL[choice]}. Change theme`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Theme: ${LABEL[choice]}`}
      >
        <ThemeIcon c={choice} />
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Theme">
          {(["light", "dark", "system"] as Choice[]).map((c) => (
            <button key={c} type="button" role="menuitemradio" aria-checked={choice === c} className="theme-opt" onClick={() => pick(c)}>
              <ThemeIcon c={c} />
              <span>{LABEL[c]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline script for <head>: applies the saved theme, or the device setting, before the first paint. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('juu-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.dataset.theme='dark'}catch(e){}`;
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap";
