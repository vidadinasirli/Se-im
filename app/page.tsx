import type { Metadata } from "next";
import Link from "next/link";
import { Countdown } from "@/app/imtahan-teqvimi/countdown";
import { questionGroups } from "@/lib/question-schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abituriyent hazırlığı — imtahan təqvimi və testlər",
  description:
    "Təsdiqlənmiş DİM imtahan tarixləri, qeydiyyat müddətləri və izahlı Riyaziyyat testləri.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Abituriyent hazırlığı",
    description: "DİM imtahan təqvimi və interaktiv hazırlıq testləri."
  }
};

export default async function HomePage() {
  const [nextEvent, currencyPage] = await Promise.all([
    prisma.examEvent.findFirst({
      where: { eventDate: { gte: new Date() } },
      orderBy: { eventDate: "asc" }
    }),
    prisma.agentPage.findUnique({
      where: { slug: "azn-try-cevirici" },
      select: { slug: true }
    })
  ]);
  const group = Object.entries(questionGroups)[0];
  const testUrl = `/testler/${group[0]}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Abituriyent hazırlığı",
    inLanguage: "az",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    description: "Azərbaycan dilində imtahan təqvimi və hazırlıq testləri."
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav
          aria-label="Əsas naviqasiya"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"
        >
          <Link href="/" className="text-lg font-bold text-slate-950">
            Abituriyent hazırlığı
          </Link>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-blue-800">
            <Link href="/imtahan-teqvimi">İmtahan təqvimi</Link>
            <Link href={testUrl}>Riyaziyyat testləri</Link>
            {currencyPage && <Link href="/valyuta/azn-try-cevirici">AZN/TRY çeviricisi</Link>}
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            DİM imtahanlarına hazırlıq
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Hazırlığını planla, biliklərini yoxla
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Təsdiqlənmiş imtahan tarixlərini izlə, Riyaziyyat testlərini həll et və hər cavabın
            izahını öyrən.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={testUrl}
              className="min-h-12 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Testə başla
            </Link>
            <Link
              href="/imtahan-teqvimi"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              Təqvimə bax
            </Link>
          </div>
        </div>

        <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Növbəti təsdiqlənmiş imtahana</h2>
          {nextEvent?.eventDate ? (
            <>
              <p className="mt-3 font-medium">{nextEvent.title}</p>
              <p className="mt-2 text-3xl font-bold text-blue-900" aria-live="polite">
                <Countdown eventDate={nextEvent.eventDate.toISOString()} />
              </p>
              <Link
                href="/imtahan-teqvimi"
                className="mt-4 inline-block font-semibold text-blue-800 underline underline-offset-2"
              >
                İmtahan təqviminə keçid
              </Link>
            </>
          ) : (
            <p className="mt-3 leading-7 text-slate-700">
              Yoxlanılmış imtahan tarixi hələ dərc edilməyib. Rəsmi təsdiqdən sonra geri sayım burada
              görünəcək.
            </p>
          )}
        </aside>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2">
        <Link
          href="/imtahan-teqvimi"
          className="rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <h2 className="text-xl font-semibold">İmtahan təqvimi</h2>
          <p className="mt-2 leading-7 text-slate-600">
            Buraxılış, blok və qəbul imtahanlarının yoxlanılmış tarixləri.
          </p>
        </Link>
        <Link
          href={testUrl}
          className="rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <h2 className="text-xl font-semibold">Riyaziyyat testləri</h2>
          <p className="mt-2 leading-7 text-slate-600">
            9-cu sinif Cəbr sualları, ani nəticə və mövzular üzrə irəliləyiş.
          </p>
        </Link>
        {currencyPage && (
          <Link
            href="/valyuta/azn-try-cevirici"
            className="rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <h2 className="text-xl font-semibold">AZN/TRY çeviricisi</h2>
            <p className="mt-2 leading-7 text-slate-600">
              Azərbaycan Mərkəzi Bankının dərc etdiyi rəsmi məzənnə ilə məlumat xarakterli çevirmə.
            </p>
          </Link>
        )}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />
    </main>
  );
}
