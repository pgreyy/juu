// The Juu docs, built from the GitBook Markdown in docs/gitbook at build time (server only).
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

/** docs/gitbook, found from the landing folder (local and on Vercel the build runs in frontend/landing). */
function docsDir() {
  // Read at build time only (every docs page is prerendered), so the bundler need not trace these paths.
  const cwd = process.cwd();
  for (const d of [path.join(/*turbopackIgnore: true*/ cwd, "../../docs/gitbook"), path.join(/*turbopackIgnore: true*/ cwd, "docs/gitbook"), path.join(/*turbopackIgnore: true*/ cwd, "../docs/gitbook")]) {
    if (fs.existsSync(path.join(/*turbopackIgnore: true*/ d, "SUMMARY.md"))) return d;
  }
  throw new Error("docs/gitbook not found");
}

// Short addresses for pages that are linked from outside the docs.
const ALIAS: Record<string, string> = { "agents/mcp.md": "mcp" };

/** "agents/mcp.md" -> "mcp", "agents/README.md" -> "agents", "README.md" -> "". */
export function slugOf(file: string) {
  if (ALIAS[file]) return ALIAS[file];
  return file.replace(/(^|\/)README\.md$/, "").replace(/\.md$/, "");
}
export const hrefOf = (file: string) => "/docs" + (slugOf(file) ? "/" + slugOf(file) : "");

export type NavItem = { title: string; file: string; href: string };
export type NavSection = { title: string | null; items: NavItem[] };

/** The page list from SUMMARY.md, in its sections. */
export function nav(): NavSection[] {
  const out: NavSection[] = [{ title: null, items: [] }];
  for (const line of fs.readFileSync(path.join(/*turbopackIgnore: true*/ docsDir(), "SUMMARY.md"), "utf8").split("\n")) {
    const h = /^##\s+(.+)/.exec(line);
    if (h) out.push({ title: h[1].trim(), items: [] });
    const m = /^\s*\*\s+\[(.+?)\]\((.+?\.md)\)/.exec(line);
    if (m) out[out.length - 1].items.push({ title: m[1], file: m[2], href: hrefOf(m[2]) });
  }
  return out.filter((s) => s.items.length);
}

export const allPages = () => nav().flatMap((s) => s.items);

const slugify = (t: string) => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One page as HTML, with its title. Links to other .md files point at their /docs address. */
export function page(file: string): { title: string; html: string } {
  let md = fs.readFileSync(path.join(/*turbopackIgnore: true*/ docsDir(), file), "utf8");
  // GitBook hint blocks become callouts.
  md = md.replace(/\{%\s*hint\s+style="(\w+)"\s*%\}/g, (_, s) => `<div class="doc-hint ${s}">\n\n`).replace(/\{%\s*endhint\s*%\}/g, "\n\n</div>");
  const title = /^#\s+(.+)$/m.exec(md)?.[1].trim() || "Juu docs";
  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
      },
    },
  });
  let html = marked.parse(md, { async: false }) as string;
  const dir = path.posix.dirname(file);
  html = html.replace(/href="([^"#:]+\.md)(#[^"]*)?"/g, (_, rel: string, hash = "") => `href="${hrefOf(path.posix.normalize(path.posix.join(dir, rel)))}${hash}"`);
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noreferrer"');
  return { title, html };
}

/** The file for a /docs address, or null. */
export function fileFor(slug: string[] | undefined) {
  const s = (slug || []).join("/");
  return allPages().find((p) => slugOf(p.file) === s)?.file ?? null;
}
