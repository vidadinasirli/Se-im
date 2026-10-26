import type { Metadata } from "next";
import Link from "next/link";
import { TuitionType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Balına uyğun ixtisasları yoxla",
  description:
    "Rəsmi balını əvvəlki qəbul ilinin dərc edilmiş keçid balları ilə müqayisə et və uyğun ixtisasları araşdır.",
  alternates: { canonical: "/bal-hesabla" },
  openGraph: {
    type: "website",
    title: "Balına uyğun ixtisasları yoxla",
    description:
      "DİM balını rəsmi qəbul məlumatları ilə müqayisə edən ixtisas seçimi simulyatoru."
  }
};

type SearchParams = {
  score?: string | string[];
  city?: string | string[];
  group?: string | string[];
  tuition?: string | string[];
  year?: string | string[];
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const groups = ["I", "II", "III", "IV", "V"] as const;
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

function parseScore(value: string): number | null {
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const score = Number(value.replace(",", "."));
  return Number.isFinite(score) && score >= 0 && score <= 700 ? score : null;
}

function scoreLabel(score: number): string {
  return scoreFormatter.format(score);
}

export default async function ScoreSimulatorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const scoreValue = firstParam(params.score);
  const score = parseScore(scoreValue);
  const hasScore = scoreValue.length > 0;
  const city = firstParam(params.city);
  const group = groups.find((item) => item === firstParam(params.group));
  const tuition = firstParam(params.tuition);
  const tuitionType =
    tuition === TuitionType.FREE || tuition === TuitionType.PAID ? tuition : undefined;
  const requestedYear = Number.parseInt(firstParam(params.year), 10);

  const [cities, years] = await Promise.all([
    prisma.universitySpecialty.findMany({
      where: { published: true, minimumAdmissionScore: { not: null } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" }
    }),
    prisma.universitySpecialty.findMany({
      where: { published: true, minimumAdmissionScore: { not: null } },
      select: { academicYear: true },
      distinct: ["academicYear"],
      orderBy: { academicYear: "desc" }
    })
  ]);
  const availableYears = years.map(({ academicYear }) => academicYear);
  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0];

  const filters: Prisma.UniversitySpecialtyWhereInput = {
    published: true,
    minimumAdmissionScore: { not: null },
    ...(city ? { city } : {}),
    ...(group ? { admissionGroup: group } : {}),
    ...(tuitionType ? { tuitionType } : {}),
    ...(selectedYear ? { academicYear: selectedYear } : {})
  };

  const [matchingPrograms, totalPrograms, nearestPrograms] = score === null
    ? [[], 0, []] as const
    : await Promise.all([
        prisma.universitySpecialty.findMany({
          where: { ...filters, minimumAdmissionScore: { lte: score } },
          orderBy: [
            { minimumAdmissionScore: "desc" },
            { universityName: "asc" },
            { specialtyName: "asc" }
          ],
          take: 30
        }),
        prisma.universitySpecialty.count({
          where: { ...filters, minimumAdmissionScore: { lte: score } }
        }),
        prisma.universitySpecialty.findMany({
          where: { ...filters, minimumAdmissionScore: { gt: score } },
          orderBy: [
            { minimumAdmissionScore: "asc" },
            { universityName: "asc" },
            { specialtyName: "asc" }
          ],
          take: 3
        })
      ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Balına uyğun ixtisas simulyatoru",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    inLanguage: "az",
    isAccessibleForFree: true,
    description:
      "İstifadəçinin daxil etdiyi balı dərc olunmuş əvvəlki qəbul ili keçid balları ilə müqayisə edir."
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Əsas naviqasiya" className="mb-8 text-sm text-blue-800">
        <Link className="underline underline-offset-2" href="/">
          Ana səhifə
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Bal simulyatoru</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Qəbul seçimi
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Balına uyğun ixtisasları yoxla
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          DİM nəticəni daxil et, şəhər və qəbul qrupu üzrə əvvəlki qəbul ilindəki rəsmi keçid
          balları ilə müqayisə et.
        </p>
      </header>

      <form
        action="/bal-hesabla"
        className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label htmlFor="score" className="mb-2 block text-sm font-semibold">
            DİM balın
          </label>
          <input
            id="score"
            name="score"
            type="number"
            inputMode="decimal"
            min="0"
            max="700"
            step="0.01"
            required
            value={scoreValue}
            placeholder="Məsələn, 450"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
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
        <div>
          <label htmlFor="year" className="mb-2 block text-sm font-semibold">
            Qəbul ili
          </label>
          <select
            id="year"
            name="year"
            defaultValue={selectedYear?.toString() ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {availableYears.length === 0 ? (
              <option value="">Məlumat yoxdur</option>
            ) : (
              availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Nəticəni göstər
          </button>
          <Link
            href="/bal-hesabla"
            className="min-h-11 content-center rounded-lg border border-slate-300 px-4 py-2 text-center font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            Sıfırla
          </Link>
        </div>
      </form>

      {hasScore && score === null && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          0 ilə 700 arasında düzgün bal daxil edin.
        </p>
      )}

      {score !== null && (
        <section aria-live="polite" className="mt-8">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-bold">Daxil etdiyin bal: {scoreLabel(score)}</h2>
            <p className="mt-2 leading-7 text-slate-700">
              {selectedYear
                ? `Nəticələr ${selectedYear}-cü ilin dərc edilmiş keçid balları ilə müqayisə olunur.`
                : "Kataloqda müqayisə üçün təsdiqlənmiş keçid balı yoxdur."}
              {" "}Bu müqayisə qəbul zəmanəti deyil; keçid balları hər il dəyişə bilər.
            </p>
          </div>

          <h2 className="mt-7 text-xl font-bold">
            {totalPrograms} uyğun ixtisas tapıldı
          </h2>

          {totalPrograms > 0 ? (
            <>
              <ul className="mt-4 grid gap-4">
                {matchingPrograms.map((program) => (
                  <li
                    key={program.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                        {program.admissionGroup} qəbul qrupu
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                        {tuitionLabels[program.tuitionType]}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold">{program.specialtyName}</h3>
                    <p className="mt-1 text-slate-700">
                      {program.universityName} · {program.city}
                    </p>
                    <p className="mt-3">
                      Keçid balı:{" "}
                      <strong>{scoreLabel(program.minimumAdmissionScore!)}</strong>
                      {" · "}
                      {program.academicYear} qəbul ili
                    </p>
                    <p className="mt-3 text-sm">
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
              {totalPrograms > matchingPrograms.length && (
                <p className="mt-4 text-sm text-slate-600">
                  İlk {matchingPrograms.length} nəticə göstərilir. Daha çox seçim üçün{" "}
                  <Link
                    className="font-semibold text-blue-800 underline underline-offset-2"
                    href="/universitet-ixtisas"
                  >
                    kataloq filtrlərindən istifadə et
                  </Link>
                  .
                </p>
              )}
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold">
                {totalPrograms === 0 && nearestPrograms.length === 0
                  ? "Bu seçim üçün rəsmi keçid balı tapılmadı"
                  : "Bu baldan aşağı keçid balı olan ixtisas yoxdur"}
              </h3>
              {nearestPrograms.length > 0 && (
                <>
                  <p className="mt-2 leading-7 text-slate-700">
                    Ən yaxın keçid ballı seçimlər:
                  </p>
                  <ul className="mt-3 space-y-3">
                    {nearestPrograms.map((program) => (
                      <li key={program.id} className="rounded-lg bg-white p-4">
                        <p className="font-semibold">
                          {program.specialtyName} — {program.universityName}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {program.city} · {program.admissionGroup} qəbul qrupu ·{" "}
                          {program.academicYear}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Keçid balı {scoreLabel(program.minimumAdmissionScore!)}; fərq{" "}
                          {scoreLabel(program.minimumAdmissionScore! - score)} baldır.
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-2 leading-7 text-slate-700">
                {selectedYear
                  ? "Filtrləri dəyişə, başqa qəbul ilinə baxa və ya rəsmi qəbul məlumatı yenilənəndə yenidən yoxlaya bilərsən."
                  : "Rəsmi keçid balları əlavə ediləndən sonra simulyatordan istifadə etmək mümkün olacaq."}
              </p>
            </div>
          )}
        </section>
      )}

      <p className="mt-8 text-sm leading-6 text-slate-600">
        Bu alət DİM balını özü hesablamır. Hesablanmış rəsmi nəticəni daxil et; qəbul qaydaları və
        ixtisas seçimi barədə yekun məlumat üçün{" "}
        <a
          className="font-medium text-blue-800 underline underline-offset-2"
          href="https://dim.gov.az/"
          target="_blank"
          rel="noreferrer"
        >
          DİM-in rəsmi saytına
        </a>{" "}
        bax.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />
    </main>
  );
}
