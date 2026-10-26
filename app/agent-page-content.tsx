import type { ReactNode } from "react";
import Link from "next/link";

export function AgentPageContent({
  title,
  description,
  content,
  sourceUrl,
  updatedAt,
  children
}: {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
  updatedAt: Date;
  children?: ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "az",
    dateModified: updatedAt.toISOString(),
    mainEntityOfPage: true,
    citation: sourceUrl
  };
  const paragraphs = content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <article>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p>
        <p className="mt-4 text-sm text-slate-500">
          Son yeniləmə: <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleDateString("az-AZ")}</time>
        </p>
        {children}
        <div className="mt-8 space-y-5 leading-8 text-slate-800">
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <nav aria-label="Əlaqəli səhifələr" className="mt-8 flex flex-wrap gap-4 text-sm font-medium">
          <Link className="text-blue-700 underline" href="/imtahan-teqvimi">İmtahan təqvimi</Link>
          <Link className="text-blue-700 underline" href="/">Ana səhifə</Link>
        </nav>
        <p className="mt-8 break-all text-sm">
          Mənbə:{" "}
          <a className="text-blue-700 underline" href={sourceUrl} target="_blank" rel="noreferrer">
            {sourceUrl}
          </a>
        </p>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
