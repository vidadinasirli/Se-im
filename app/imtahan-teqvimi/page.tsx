import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İmtahan təqvimi və qeydiyyat tarixləri",
  description:
    "DİM buraxılış, blok və qəbul imtahanlarının təsdiqlənmiş tarixlərini və qeydiyyat müddətlərini izləyin.",
  alternates: { canonical: "/imtahan-teqvimi" },
  openGraph: {
    type: "website",
    title: "İmtahan təqvimi və qeydiyyat tarixləri",
    description: "DİM imtahanlarının yoxlanılmış tarixləri və qeydiyyat müddətləri."
  }
};

const eventTypeLabels = {
  BURAXILIS: "Buraxılış imtahanı",
  BLOK: "Blok imtahanı",
  QEBUL: "Qəbul imtahanı",
  OTHER: "Digər elan"
} as const;

const dateFormatter = new Intl.DateTimeFormat("az-AZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Baku"
});

export default async function ExamCalendarPage() {
  const events = await prisma.examEvent.findMany({
    where: {
      OR: [{ eventDate: { gte: new Date() } }, { eventDate: null }]
    },
    orderBy: [{ eventDate: "asc" }, { applicationDeadline: "asc" }]
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Təsdiqlənmiş imtahan tarixləri",
    itemListElement: events
      .filter((event): event is typeof event & { eventDate: Date } => event.eventDate !== null)
      .map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Event",
        name: event.title,
        startDate: event.eventDate!.toISOString(),
        eventStatus: "https://schema.org/EventScheduled",
        organizer: { "@type": "Organization", name: "Dövlət İmtahan Mərkəzi" },
        url: event.sourceUrl,
        description: event.description ?? event.title
      }
      }))
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Əsas naviqasiya" className="mb-8 text-sm text-blue-800">
        <Link className="underline underline-offset-2" href="/">
          Ana səhifə
        </Link>
        <span aria-hidden="true"> / </span>
        <span>İmtahan təqvimi</span>
      </nav>
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          DİM elanları
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          İmtahan təqvimi
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Buraxılış, blok və qəbul imtahanlarının tarixləri rəsmi mənbədən yoxlanılır,
          yalnız inzibatçı təsdiqindən sonra dərc olunur.
        </p>
      </header>

      {events.length === 0 ? (
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold">Təsdiqlənmiş tarix yoxdur</h2>
          <p className="mt-2 leading-7 text-slate-700">
            DİM-in rəsmi səhifəsində tarixlər elan ediləndə və yoxlanıldıqdan sonra burada görünəcək.
            Təxmini tarix dərc edilmir.
          </p>
          <a
            className="mt-4 inline-block font-semibold text-blue-800 underline underline-offset-2"
            href="https://dim.gov.az/"
            target="_blank"
            rel="noreferrer"
          >
            DİM-in rəsmi saytına keçid
          </a>
        </section>
      ) : (
        <ol className="mt-8 space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                  {eventTypeLabels[event.type]}
                </span>
                <span className="text-sm text-slate-500">
                  Son yeniləmə: {dateFormatter.format(event.updatedAt)}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold">{event.title}</h2>
              {event.description && (
                <p className="mt-2 leading-7 text-slate-700">{event.description}</p>
              )}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-sm text-slate-600">İmtahan tarixi</dt>
                  <dd className="mt-1 font-semibold">
                    {event.eventDate
                      ? dateFormatter.format(event.eventDate)
                      : "Rəsmi elanda göstərilməyib"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-sm text-slate-600">Son qeydiyyat tarixi</dt>
                  <dd className="mt-1 font-semibold">
                    {event.applicationDeadline
                      ? dateFormatter.format(event.applicationDeadline)
                      : "Rəsmi elanda göstərilməyib"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm">
                Mənbə:{" "}
                <a
                  className="break-all font-medium text-blue-800 underline underline-offset-2"
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  DİM-in rəsmi elanı
                </a>
              </p>
            </li>
          ))}
        </ol>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />
    </main>
  );
}
