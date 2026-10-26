import type { Metadata } from "next";
import Link from "next/link";
import { questionGroups } from "@/lib/question-schema";
import { prisma } from "@/lib/prisma";
import { StudyPlanBuilder, type StudyPlanSubject } from "./study-plan-builder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "30, 60 və 90 günlük hazırlıq planı",
  description:
    "Fənn və həftəlik dərs günlərinə uyğun 30, 60 və ya 90 günlük fərdi imtahan hazırlıq planı qur.",
  alternates: { canonical: "/hazirliq-plani" },
  openGraph: {
    type: "website",
    title: "Fərdi hazırlıq planı",
    description:
      "Fənn mövzularını, testləri və təkrar günlərini birləşdirən 30, 60 və 90 günlük plan."
  }
};

export default async function StudyPlanPage() {
  const records = await prisma.question.findMany({
    where: { status: "APPROVED" },
    select: { groupSlug: true, topic: true }
  });
  const availableSubjects: StudyPlanSubject[] = Object.entries(questionGroups).map(
    ([groupSlug, group]) => {
      const topics = [...new Set(
        records
          .filter((record) => record.groupSlug === groupSlug)
          .map((record) => record.topic.trim())
          .filter(Boolean)
      )].sort((first, second) => first.localeCompare(second, "az"));

      return {
        id: groupSlug,
        label: `${group.subject} · ${group.grade}-cu sinif`,
        subject: group.subject,
        grade: group.grade,
        topics: topics.length > 0 ? topics : [group.topic],
        testUrl: `/testler/${groupSlug}`
      };
    }
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Fərdi imtahan hazırlıq planı",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any",
    inLanguage: "az",
    isAccessibleForFree: true,
    description:
      "Fənn, müddət və həftəlik dərs günlərinə görə imtahan hazırlıq planı yaradır."
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Əsas naviqasiya" className="mb-8 text-sm text-blue-800">
        <Link className="underline underline-offset-2" href="/">
          Ana səhifə
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Hazırlıq planı</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Addım-addım hazırlaş
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Fərdi hazırlıq planı
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Fənni, plan müddətini və həftədə neçə gün oxuya biləcəyini seç. Plan mövzuları və test
          keçidləri təsdiqlənmiş suallardan hazırlanır, irəliləyiş isə bu brauzerdə saxlanılır.
        </p>
      </header>

      <StudyPlanBuilder subjects={availableSubjects} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />
    </main>
  );
}
