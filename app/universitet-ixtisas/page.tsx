import type { Metadata } from "next";
import Link from "next/link";
import { TuitionType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Universitet və ixtisas kataloqu",
  description:
    "Universitet və ixtisasları şəhərə, qəbul qrupuna və təhsil formasına görə axtarın. Keçid balları rəsmi mənbə ilə göstərilir.",
  alternates: { canonical: "/universitet-ixtisas" },
  openGraph: {
    type: "website",
    title: "Universitet və ixtisas kataloqu",
    description:
      "Azərbaycan universitetlərindəki ixtisasları qəbul qrupu, şəhər və ödəniş növünə görə süzün."
  }
};

type SearchParams = {
  q?: string | string[];
  city?: string | string[];
  group?: string | string[];
  tuition?: string | string[];
  page?: string | string[];
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const groups = ["I", "II", "III", "IV", "V"] as const;
const dateFormatter = new Intl.DateTimeFormat("az-AZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Baku"
});
const scoreFormatter = new Intl.NumberFormat("az-AZ", {
  maximumFractionDigits: 2
});
const tuitionLabels: Record<TuitionType, string> = {
  [TuitionType.FREE]: "Dövlət sifarişli",
  [TuitionType.PAID]: "Ödənişli"
};

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function UniversitySpecialtyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = firstParam(params.q).slice(0, 80);
  const city = firstParam(params.city);
  const group = groups.find((item) => item === firstParam(params.group));
  const tuition = firstParam(params.tuition);
  const tuitionType =
    tuition === TuitionType.FREE || tuition === TuitionType.PAID ? tuition : undefined;
  const parsedPage = Number.parseInt(firstParam(params.page), 10);
  const currentPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 30;
  const where: Prisma.UniversitySpecialtyWhereInput = {
    published: true,
    ...(city ? { city } : {}),
    ...(group ? { admissionGroup: group } : {}),
    ...(tuitionType ? { tuitionType } : {}),
    ...(query
      ? {
          OR: [
            { universityName: { contains: query } },
            { specialtyName: { contains: query } },
            { city: { contains: query } }
          ]
        }
      : {})
  };

  const [cities, programs, totalPrograms] = await Promise.all([
    prisma.universitySpecialty.findMany({
      where: { published: true },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" }
    }),
    prisma.universitySpecialty.findMany({
      where,
      orderBy: [
        { academicYear: "desc" },
        { universityName: "asc" },
        { specialtyName: "asc" }
      ],
      skip: (currentPage - 1) * pageSize,
      take: pageSize
    }),
    prisma.universitySpecialty.count({ where })
  ]);
  const pageCount = Math.ceil(totalPrograms / pageSize);

  function pageHref(page: number): string {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (city) search.set("city", city);
    if (group) search.set("group", group);
    if (tuitionType) search.set("tuition", tuitionType);
    search.set("page", String(page));
    return `/universitet-ixtisas?${search.toString()}`;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Universitet və ixtisas kataloqu",
    inLanguage: "az",
    numberOfItems: totalPrograms,
    itemListElement: programs.map((program, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "EducationalOccupationalProgram",
        name: program.specialtyName,
        educationalProgramMode: program.tuitionType === "FREE" ? "Dövlət sifarişli" : "Ödənişli",
        provider: {
          "@type": "CollegeOrUniversity",
          name: program.universityName,
          address: { "@type": "PostalAddress", addressLocality: program.city }
        },
        url: program.sourceUrl
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
        <span>Universitet və ixtisaslar</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Ali təhsil seçimi
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Universitet və ixtisas kataloqu
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          İxtisasları şəhərə, qəbul qrupuna və təhsil növünə görə süzün. Keçid balı yalnız rəsmi
          mənbə və qəbul ili ilə birlikdə təqdim olunur.
        </p>
      </header>

      <form
        action="/universitet-ixtisas"
        className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="q" className="mb-2 block text-sm font-semibold">
            Universitet və ya ixtisas
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={query}
            placeholder="Məsələn, universitetin və ya ixtisasın adı"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
        </div>
        <div>
          <label htmlFor="city" className="mb-2 block text-sm font-semibold">
            Şəhər
          </label>
          <select
            id="city"
            name="city"
            defaultValue={city}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <option value="">Bütün şəhərlər</option>
            {cities.map(({ city: cityName }) => (
              <option key={cityName} value={cityName}>
                {cityName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="group" className="mb-2 block text-sm font-semibold">
            Qəbul qrupu
          </label>
          <select
            id="group"
            name="group"
            defaultValue={group ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <option value="">Bütün qruplar</option>
            {groups.map((item) => (
              <option key={item} value={item}>
                {item} qəbul qrupu
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tuition" className="mb-2 block text-sm font-semibold">
            Təhsil növü
          </label>
          <select
            id="tuition"
            name="tuition"
            defaultValue={tuitionType ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <option value="">Hamısı</option>
            <option value={TuitionType.FREE}>Dövlət sifarişli</option>
            <option value={TuitionType.PAID}>Ödənişli</option>
          </select>
        </div>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Axtar
          </button>
          <Link
            href="/universitet-ixtisas"
            className="min-h-11 content-center rounded-lg border border-slate-300 px-4 py-2 text-center font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            Sıfırla
          </Link>
        </div>
      </form>

      <section aria-live="polite" className="mt-8">
        <h2 className="text-xl font-bold">
          {totalPrograms} ixtisas tapıldı
        </h2>
        {totalPrograms === 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h3 className="font-semibold text-slate-900">
              {cities.length === 0
                ? "Rəsmi ixtisas məlumatları hələ əlavə edilməyib"
                : "Bu meyarlara uyğun ixtisas tapılmadı"}
            </h3>
            <p className="mt-2 leading-7 text-slate-700">
              {cities.length === 0
                ? "Yanlış bal və ödəniş məlumatı göstərməmək üçün kataloq yalnız rəsmi qəbul məlumatları yoxlanıldıqdan sonra yenilənəcək."
                : "Axtarış meyarlarını dəyişin və ya bütün ixtisaslara baxın."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4">
            {programs.map((program) => (
              <li
                key={program.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                    {program.admissionGroup} qəbul qrupu
                    {program.admissionSubgroup ? ` · ${program.admissionSubgroup}` : ""}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                    {tuitionLabels[program.tuitionType]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {program.academicYear} qəbul ili
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold">{program.specialtyName}</h3>
                <p className="mt-1 text-slate-700">
                  {program.universityName} · {program.city}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-sm text-slate-600">Keçid balı</dt>
                    <dd className="mt-1 font-semibold">
                      {program.minimumAdmissionScore === null
                        ? "Rəsmi məlumat göstərilməyib"
                        : scoreFormatter.format(program.minimumAdmissionScore)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-sm text-slate-600">İllik təhsil haqqı</dt>
                    <dd className="mt-1 font-semibold">
                      {program.tuitionType === TuitionType.FREE
                        ? "Dövlət sifarişi"
                        : program.annualTuition === null
                          ? "Rəsmi məlumat göstərilməyib"
                          : `${new Intl.NumberFormat("az-AZ").format(program.annualTuition)} AZN`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-slate-600">
                  Son yeniləmə: {dateFormatter.format(program.updatedAt)}
                </p>
                <p className="mt-1 text-sm">
                  Mənbə:{" "}
                  <a
                    className="break-all font-medium text-blue-800 underline underline-offset-2"
                    href={program.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Rəsmi qəbul məlumatı
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
        {pageCount > 1 && (
          <nav aria-label="Səhifələmə" className="mt-6 flex items-center justify-between">
            {currentPage > 1 ? (
              <Link
                href={pageHref(currentPage - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Əvvəlki
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-600">
              {currentPage} / {pageCount}
            </span>
            {currentPage < pageCount ? (
              <Link
                href={pageHref(currentPage + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Növbəti
              </Link>
            ) : (
              <span />
            )}
          </nav>
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
