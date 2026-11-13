"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { NavSection } from "@/lib/docs";

/** The docs page list: a sidebar on wide screens, a fold-out list on phones. */
export function DocNav({ sections }: { sections: NavSection[] }) {
  const path = usePathname().replace(/\/$/, "") || "/docs";
  const list = (
    <>
      {sections.map((s, i) => (
        <div key={i} className="doc-navsec">
          {s.title && <div className="label">{s.title}</div>}
          <ul>
            {s.items.map((it) => (
              <li key={it.file}>
                <Link href={it.href} aria-current={path === it.href ? "page" : undefined}>{it.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
  return (
    <>
      <nav className="doc-side" aria-label="Docs pages">{list}</nav>
      <details className="doc-fold">
        <summary>All docs pages</summary>
        <nav aria-label="Docs pages">{list}</nav>
      </details>
    </>
  );
}

/** Adds a copy button to every code block on the page. */
export function CodeCopy() {
  useEffect(() => {
    document.querySelectorAll<HTMLPreElement>(".doc-body pre").forEach((pre) => {
      if (pre.dataset.copy) return;
      pre.dataset.copy = "1";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "doc-copy";
      b.textContent = "COPY";
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector("code")?.textContent ?? "");
          b.textContent = "COPIED";
          setTimeout(() => (b.textContent = "COPY"), 2000);
        } catch {}
      });
      pre.appendChild(b);
    });
  });
  return null;
}
