import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { questionGroups, type QuestionGroupSlug } from "@/lib/question-schema";
import { prisma } from "@/lib/prisma";
import { QuestionSet } from "./question-set";
import { z } from "zod";

type PageProps = { params: Promise<{ group: string }> };

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return Object.keys(questionGroups).map((group) => ({ group }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { group } = await params;
  const groupInfo = questionGroups[group as QuestionGroupSlug];
  if (!groupInfo) return { title: "Test tapılmadı" };

  return {
    title: `${groupInfo.title} testləri`,
    description: `${groupInfo.grade}-cu sinif ${groupInfo.subject} fənnindən ${groupInfo.topic} testlərini həll edin, nəticənizi və mövzu statistikasını görün.`,
    alternates: { canonical: `/testler/${group}` },
    openGraph: {
      type: "website",
      title: `${groupInfo.title} testləri`,
      description: `${groupInfo.topic} üzrə interaktiv test və izahlı cavablar.`
    }
  };
}

export default async function QuestionGroupPage({ params }: PageProps) {
  const { group } = await params;
  const groupInfo = questionGroups[group as QuestionGroupSlug];
  if (!groupInfo) notFound();

  const records = await prisma.question.findMany({
    where: { groupSlug: group, status: "APPROVED" },
    orderBy: [{ topic: "asc" }, { createdAt: "asc" }]
  });

  const questions = records.map((question) => {
    const options = z
      .array(z.string())
      .length(4)
      .parse(question.options);
    return { ...question, options };
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: `${groupInfo.title} testləri`,
    description: `${groupInfo.topic} mövzusundan interaktiv testlər və izahlı cavablar.`,
    inLanguage: "az",
    educationalLevel: `${groupInfo.grade}-cu sinif`,
    learningResourceType: "Practice problem",
    teaches: groupInfo.topic,
    isAccessibleForFree: true,
    hasPart: questions.map((question) => ({
      "@type": "Question",
      name: question.prompt,
      educationalLevel: `${question.grade}-cu sinif`,
      acceptedAnswer: {
        "@type": "Answer",
        text: question.options[question.correctIndex]
      },
      comment: question.explanation
    }))
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <nav aria-label="Əsas naviqasiya" className="mb-8 text-sm text-blue-800">
        <Link className="underline underline-offset-2" href="/">
          Ana səhifə
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Testlər</span>
      </nav>
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          {groupInfo.subject} · {groupInfo.grade}-cu sinif
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {groupInfo.topic} testləri
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Cavab seçdikdən sonra nəticəni və izahı dərhal görəcəksiniz. İrəliləyiş yalnız bu
          brauzerdə saxlanılır; qeydiyyat tələb olunmur.
        </p>
      </header>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6">
          Bu qrupda hələ dərc olunmuş sual yoxdur.
        </p>
      ) : (
        <QuestionSet
          groupSlug={group}
          questions={questions.map((question) => ({
            id: question.id,
            topic: question.topic,
            difficulty: question.difficulty,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation
          }))}
        />
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
