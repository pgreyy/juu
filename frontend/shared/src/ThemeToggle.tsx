"use client";
import { useEffect, useState } from "react";

/** DARK / LIGHT switch. Saves the choice; the page's head script applies it before first paint. */
export function ThemeToggle({ className = "hbtn quiet" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("juu-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button type="button" className={className} onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? "LIGHT" : "DARK"}
    </button>
  );
}

/** Inline script for <head>: applies a saved dark theme before the first paint. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('juu-theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap";
