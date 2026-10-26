"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { submitIndexNow } from "@/jobs/admin-agent";
import { generateQuestionDrafts } from "@/jobs/generate-question-drafts";
import { questionDraftSchema } from "@/lib/question-schema";
import { dimEventValueSchema, toExamEventRecord } from "@/lib/dim-event";
import { agentPagePayloadSchema } from "@/lib/agent-page-schema";
import { stableJson, toInputJsonValue } from "@/lib/prisma-json";
import { prisma } from "@/lib/prisma";

type ReviewDecision = "approve" | "reject";

// Təsdiq və rədd qərarını dəyişiklik qeydi ilə birlikdə atomik saxlayır.
export async function reviewPendingChange(formData: FormData) {
  const id = formData.get("id");
  const decision = formData.get("decision");

  if (typeof id !== "string" || !id || (decision !== "approve" && decision !== "reject")) {
    throw new Error("Dəyişiklik qərarı düzgün deyil.");
  }

  const contentKey = await applyReviewDecision(id, decision);
  revalidatePath("/admin");
  revalidatePath("/imtahan-teqvimi");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (contentKey.startsWith("agent-page:")) {
    revalidatePath(`/${agentPagePath(contentKey.slice("agent-page:".length))}`);
  }
}

// Riyaziyyat suallarını AI ilə yaradır və yoxlanış üçün qaralama kimi saxlayır.
export async function generateQuestionDraftsAction(): Promise<void> {
  await generateQuestionDrafts();
  revalidatePath("/admin");
}

// Sualı yalnız inzibatçı qərarından sonra dərc edir.
export async function reviewQuestion(formData: FormData) {
  const id = formData.get("id");
  const decision = formData.get("decision");

  if (typeof id !== "string" || !id || (decision !== "approve" && decision !== "reject")) {
    throw new Error("Sual qərarı düzgün deyil.");
  }

  const question = await prisma.question.findUnique({ where: { id } });
  if (!question || question.status !== "DRAFT") {
    throw new Error("Sual tapılmadı və ya artıq nəzərdən keçirilib.");
  }

  const validated = questionDraftSchema.parse({
    groupSlug: question.groupSlug,
    subject: question.subject,
    grade: question.grade,
    topic: question.topic,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation
  });

  await prisma.$transaction(async (transaction) => {
    const result = await transaction.question.updateMany({
      where: { id, status: "DRAFT" },
      data: { ...validated, status: decision === "approve" ? "APPROVED" : "REJECTED" }
    });
    if (result.count !== 1) throw new Error("Sual artıq başqa qərarla nəzərdən keçirilib.");
    await transaction.jobLog.create({
      data: {
        jobName: "question-review",
        status: "SUCCESS",
        message: `${id} nömrəli sual ${decision === "approve" ? "təsdiqləndi" : "rədd edildi"}.`
      }
    });
  });
  revalidatePath("/admin");
  revalidatePath(`/testler/${question.groupSlug}`);
}

// Son saxlanmış səhifə versiyasını bərpa edir və rollback qərarını qeyd edir.
export async function rollbackAgentPage(formData: FormData) {
  const slug = formData.get("slug");
  const versionValue = formData.get("version");
  const version = typeof versionValue === "string" ? Number(versionValue) : NaN;
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9-]{3,90}$/.test(slug) ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new Error("Səhifə ünvanı düzgün deyil.");
  }

  await prisma.$transaction(async (transaction) => {
    const [page, revision] = await Promise.all([
      transaction.agentPage.findUnique({ where: { slug } }),
      transaction.agentPageRevision.findFirst({
        where: { pageSlug: slug, version }
      })
    ]);
    if (!page || !revision) throw new Error("Geri qaytarılacaq səhifə versiyası yoxdur.");

    const latestRevision = await transaction.agentPageRevision.findFirst({
      where: { pageSlug: slug },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const snapshotVersion = (latestRevision?.version ?? 0) + 1;
    await transaction.agentPageRevision.create({
      data: {
        pageSlug: slug,
        title: page.title,
        description: page.description,
        content: page.content,
        sourceUrl: page.sourceUrl,
        structuredData: page.structuredData ?? Prisma.JsonNull,
        riskLevel: page.riskLevel,
        confidence: page.confidence,
        factCheckPassed: page.factCheckPassed,
        version: snapshotVersion
      }
    });
    await transaction.agentPage.update({
      where: { slug },
      data: {
        title: revision.title,
        description: revision.description,
        content: revision.content,
        sourceUrl: revision.sourceUrl,
        structuredData: revision.structuredData ?? Prisma.JsonNull,
        riskLevel: revision.riskLevel,
        confidence: revision.confidence,
        factCheckPassed: revision.factCheckPassed,
        publishedAt: new Date(),
        noindex: false
      }
    });
    const pageValue = {
      slug,
      title: revision.title,
      description: revision.description,
      content: revision.content,
      sourceUrl: revision.sourceUrl,
      riskLevel: revision.riskLevel,
      confidence: revision.confidence,
      factCheckPassed: revision.factCheckPassed,
      structuredData: revision.structuredData
    };
    await transaction.contentItem.upsert({
      where: { key: `agent-page:${slug}` },
      create: {
        key: `agent-page:${slug}`,
        value: toInputJsonValue(pageValue),
        sourceUrl: revision.sourceUrl,
        confidence: revision.confidence
      },
      update: {
        value: toInputJsonValue(pageValue),
        sourceUrl: revision.sourceUrl,
        confidence: revision.confidence
      }
    });
    await transaction.agentLog.create({
      data: {
        level: "WARNING",
        stage: "rollback",
        message: `/${agentPagePath(slug)} səhifəsi əvvəlki versiyaya qaytarıldı.`,
        details: { slug, restoredVersion: revision.version, snapshotVersion }
      }
    });
  });

  revalidatePath(`/guide/${slug}`);
  revalidatePath(`/valyuta/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
}

// Səhifənin indekslənmə qərarını inzibatçı əməliyyatı kimi qeyd edir.
export async function setAgentPageIndexing(formData: FormData) {
  const slug = formData.get("slug");
  const noindexValue = formData.get("noindex");
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9-]{3,90}$/.test(slug) ||
    (noindexValue !== "true" && noindexValue !== "false")
  ) {
    throw new Error("İndekslənmə qərarı düzgün deyil.");
  }
  const noindex = noindexValue === "true";
  await prisma.$transaction(async (transaction) => {
    const page = await transaction.agentPage.update({
      where: { slug },
      data: { noindex }
    });
    await transaction.agentLog.create({
      data: {
        level: "INFO",
        stage: "indexing-policy",
        message: `${page.title} səhifəsi ${noindex ? "indekslənmədən çıxarıldı" : "indekslənməyə açıldı"}.`,
        details: { slug, noindex }
      }
    });
  });
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath(`/${agentPagePath(slug)}`);
}

async function applyReviewDecision(id: string, decision: ReviewDecision) {
  const contentKey = await prisma.$transaction(async (transaction) => {
    const pending = await transaction.pendingChange.findUnique({ where: { id } });

    if (!pending || pending.status !== "PENDING") {
      throw new Error("Dəyişiklik tapılmadı və ya artıq nəzərdən keçirilib.");
    }

    const current = await transaction.contentItem.findUnique({
      where: { key: pending.contentKey }
    });
    if (stableJson(current?.value ?? null) !== stableJson(pending.oldValue)) {
      throw new Error("Məlumat dəyişdiyi üçün bu yenilik artıq köhnəlib.");
    }

    await transaction.pendingChange.update({
      where: { id },
      data: { status: decision === "approve" ? "APPROVED" : "REJECTED", reviewedAt: new Date() }
    });

    if (decision === "approve") {
      await transaction.contentItem.upsert({
        where: { key: pending.contentKey },
        create: {
          key: pending.contentKey,
          value: toInputJsonValue(pending.newValue),
          sourceUrl: pending.sourceUrl,
          confidence: pending.confidence
        },
        update: {
          value: toInputJsonValue(pending.newValue),
          sourceUrl: pending.sourceUrl,
          confidence: pending.confidence
        }
      });

      if (pending.contentKey.startsWith("dim-event:")) {
        const event = dimEventValueSchema.parse(pending.newValue);
        const eventId = pending.contentKey.slice("dim-event:".length);
        if (event.id !== eventId || event.sourceUrl !== pending.sourceUrl) {
          throw new Error("Təqvim məlumatı mənbə və ya açarla uyğun gəlmir.");
        }
        await transaction.examEvent.upsert({
          where: { id: event.id },
          create: toExamEventRecord(event),
          update: toExamEventRecord(event)
        });
      }

      if (pending.contentKey.startsWith("agent-page:")) {
        const page = agentPagePayloadSchema.parse(pending.newValue);
        const slug = pending.contentKey.slice("agent-page:".length);
        if (page.slug !== slug || page.sourceUrl !== pending.sourceUrl) {
          throw new Error("Agent səhifəsinin açarı və ya mənbə ünvanı uyğun gəlmir.");
        }
        const existingPage = await transaction.agentPage.findUnique({ where: { slug } });
        if (existingPage) {
          const version =
            (await transaction.agentPageRevision.count({ where: { pageSlug: slug } })) + 1;
          await transaction.agentPageRevision.create({
            data: {
              pageSlug: slug,
              title: existingPage.title,
              description: existingPage.description,
              content: existingPage.content,
              sourceUrl: existingPage.sourceUrl,
              structuredData: existingPage.structuredData ?? Prisma.JsonNull,
              riskLevel: existingPage.riskLevel,
              confidence: existingPage.confidence,
              factCheckPassed: existingPage.factCheckPassed,
              version
            }
          });
        }
        await transaction.agentPage.upsert({
          where: { slug },
          create: {
            ...page,
            structuredData: page.structuredData ?? Prisma.JsonNull,
            autoPublished: false,
            publishedAt: new Date(),
            noindex: false
          },
          update: {
            ...page,
            structuredData: page.structuredData ?? Prisma.JsonNull,
            publishedAt: new Date(),
            noindex: false
          }
        });
        await transaction.opportunity.updateMany({
          where: { pageSlug: slug, status: "PENDING_REVIEW" },
          data: { status: "PUBLISHED", reason: null, processedAt: new Date() }
        });
        await transaction.agentLog.create({
          data: {
            level: "INFO",
            stage: "manual-publish",
            message: `İnzibatçı agent səhifəsini təsdiqlədi: /${agentPagePath(slug)}.`
          }
        });
      }
    }

    await transaction.changeLog.create({
      data: {
        contentKey: pending.contentKey,
        action: decision === "approve" ? "APPROVED" : "REJECTED",
        oldValue: toInputJsonValue(pending.oldValue),
        newValue: toInputJsonValue(pending.newValue),
        sourceUrl: pending.sourceUrl,
        confidence: pending.confidence
      }
    });
    return pending.contentKey;
  });
  if (decision === "approve" && contentKey.startsWith("agent-page:")) {
    const slug = contentKey.slice("agent-page:".length);
    await submitIndexNow(`/${agentPagePath(slug)}`);
  }
  return contentKey;
}

function agentPagePath(slug: string) {
  return slug === "azn-try-cevirici" ? `valyuta/${slug}` : `guide/${slug}`;
}
