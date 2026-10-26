import { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateGroqStructuredData } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const weeklyDraftSchema = z.object({
  subject: z.string().trim().min(8).max(120).regex(/^[^\r\n]+$/),
  preview: z.string().trim().min(10).max(200),
  content: z.string().trim().min(300).max(4_000)
});

// Yalnız dərc olunmuş test mövzularına əsaslanan, inzibatçı yoxlamalı həftəlik qaralama yaradır.
export async function generateWeeklyNewsletterDraft(now = new Date()) {
  const weekKey = getWeekKey(now);
  const existing = await prisma.newsletterDraft.findUnique({ where: { weekKey } });
  if (existing) return { created: false, id: existing.id };

  const questions = await prisma.question.findMany({
    where: { status: "APPROVED" },
    select: {
      groupSlug: true,
      subject: true,
      grade: true,
      topic: true,
      prompt: true,
      explanation: true
    },
    orderBy: [{ subject: "asc" }, { topic: "asc" }, { createdAt: "desc" }],
    take: 12
  });
  if (questions.length === 0) {
    throw new Error("Həftəlik plan üçün təsdiqlənmiş test sualı tapılmadı.");
  }

  const sourceTopics = [...new Map(
    questions.map((question) => [
      `${question.subject}|${question.grade}|${question.topic}`,
      {
        groupSlug: question.groupSlug,
        subject: question.subject,
        grade: question.grade,
        topic: question.topic,
        question: question.prompt,
        explanation: question.explanation
      }
    ])
  ).values()];
  const { data } = await generateGroqStructuredData(
    `Bu həftə üçün Azərbaycan dilində, abituriyentə yönəlmiş qısa hazırlıq bülleteni yaz. ` +
      `Yalnız aşağıdakı dərc edilmiş test mövzularından istifadə et. Yeni fakt, tarix, bal, qayda ` +
      `və ya mənbə uydurma. Bülleten ümumi istiqamətləndirici olsun, hüquqi/qəbul zəmanəti verməsin. ` +
      `Məzmun 300–4000 simvol, hər gün üçün qısa və praktik məşq təklifi olan həftəlik plan olsun. ` +
      `Mənbə mövzuları JSON: ${JSON.stringify(sourceTopics)}`,
    weeklyDraftSchema,
    "Sən Azərbaycan dilində yazan imtahan hazırlığı redaktorusan. Yalnız istifadəçinin verdiyi dərc olunmuş test materialına əsaslan. Mənbədə olmayan fakt uydurma. Yalnız tələb olunan JSON qaytar."
  );

  try {
    const draft = await prisma.newsletterDraft.create({
      data: {
        weekKey,
        subject: data.subject,
        preview: data.preview,
        content: data.content,
        sources: toJsonInput(sourceTopics.map((item) => ({
          title: `${item.subject} · ${item.topic}`,
          url: `/testler/${item.groupSlug}`
        })))
      }
    });
    await prisma.jobLog.create({
      data: {
        jobName: "newsletter-draft",
        status: "SUCCESS",
        message: `${weekKey} həftəsi üçün inzibatçı baxışı gözləyən bülleten qaralaması yaradıldı.`
      }
    });
    return { created: true, id: draft.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentDraft = await prisma.newsletterDraft.findUnique({ where: { weekKey } });
      if (concurrentDraft) return { created: false, id: concurrentDraft.id };
    }
    throw error;
  }
}

function getWeekKey(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return utcDate.toISOString().slice(0, 10);
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
