import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeCopy } from "@/components/DocNav";
import { allPages, fileFor, page, slugOf } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return allPages().map((p) => ({ slug: slugOf(p.file) ? slugOf(p.file).split("/") : [] }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const file = fileFor((await params).slug);
  if (!file) return {};
  const { title } = page(file);
  return { title: `${title} · Juu docs`, description: "Juu docs: the gamified Bitcoin money layer on Mezo." };
}

export default async function DocPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const file = fileFor((await params).slug);
  if (!file) notFound();
  const { html } = page(file);
  const pages = allPages();
  const i = pages.findIndex((p) => p.file === file);
  const prev = pages[i - 1], next = pages[i + 1];
  return (
    <>
      <article className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
      <CodeCopy />
      <nav className="doc-pager" aria-label="Previous and next page">
        {prev ? <a href={prev.href}>← {prev.title}</a> : <span />}
        {next ? <a href={next.href}>{next.title} →</a> : <span />}
      </nav>
    </>
  );
}
