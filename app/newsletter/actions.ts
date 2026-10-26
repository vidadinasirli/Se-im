"use server";

import { revalidatePath } from "next/cache";
import { generateWeeklyNewsletterDraft } from "@/jobs/newsletter-draft";
import { sendNewsletterEmail } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";

export async function createNewsletterDraftAction() {
  await generateWeeklyNewsletterDraft();
  revalidatePath("/admin");
}

// Abunəçilərə yalnız inzibatçı təsdiqindən sonra, təkrarlanan göndəriş qoruması ilə çatdırır.
export async function approveAndSendNewsletterAction(formData: FormData) {
  const draftId = formData.get("draftId");
  if (typeof draftId !== "string" || !draftId) throw new Error("Bülleten seçilməyib.");

  const draft = await prisma.newsletterDraft.findUnique({ where: { id: draftId } });
  if (!draft || !["PENDING_REVIEW", "APPROVED"].includes(draft.status)) {
    throw new Error("Bülleten tapılmadı və ya artıq göndərilib.");
  }
  if (!process.env.RESEND_API_KEY || !process.env.NEWSLETTER_FROM) {
    throw new Error("Göndəriş üçün RESEND_API_KEY və NEWSLETTER_FROM sazlanmalıdır.");
  }

  if (draft.status === "PENDING_REVIEW") {
    await prisma.newsletterDraft.update({
      where: { id: draft.id },
      data: { status: "APPROVED", reviewedAt: new Date() }
    });
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: {
      status: "CONFIRMED",
      deliveries: { none: { draftId, status: "SENT" } }
    },
    select: { id: true, email: true, unsubscribeToken: true },
    orderBy: { confirmedAt: "asc" },
    take: 20
  });
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < subscribers.length; index += 2) {
    const batch = subscribers.slice(index, index + 2);
    const outcomes = await Promise.all(
      batch.map(async (subscriber) => {
        const existing = await prisma.newsletterDelivery.findUnique({
          where: { draftId_subscriberId: { draftId, subscriberId: subscriber.id } }
        });
        if (existing?.status === "SENT") return "skipped";
        if (
          existing?.status === "SENDING" &&
          Date.now() - existing.updatedAt.getTime() < 5 * 60_000
        ) {
          return "skipped";
        }

        const delivery = await prisma.newsletterDelivery.upsert({
          where: { draftId_subscriberId: { draftId, subscriberId: subscriber.id } },
          create: {
            draftId,
            subscriberId: subscriber.id,
            status: "SENDING"
          },
          update: { status: "SENDING", error: null }
        });
        try {
          const messageId = await sendNewsletterEmail({
            to: subscriber.email,
            subject: draft.subject,
            preview: draft.preview,
            content: draft.content,
            unsubscribeUrl: `${getSiteUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`,
            idempotencyKey: `newsletter-${draft.id}-${subscriber.id}`
          });
          await prisma.newsletterDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "SENT",
              providerMessageId: messageId,
              error: null,
              sentAt: new Date()
            }
          });
          return "sent";
        } catch (error) {
          const message = error instanceof Error ? error.message : "Göndəriş alınmadı.";
          await prisma.newsletterDelivery.update({
            where: { id: delivery.id },
            data: { status: "FAILED", error: message.slice(0, 500) }
          });
          return "failed";
        }
      })
    );
    sent += outcomes.filter((outcome) => outcome === "sent").length;
    failed += outcomes.filter((outcome) => outcome === "failed").length;
  }

  const remaining = await prisma.newsletterSubscriber.count({
    where: {
      status: "CONFIRMED",
      deliveries: { none: { draftId, status: "SENT" } }
    }
  });
  if (remaining === 0 && failed === 0) {
    await prisma.newsletterDraft.update({
      where: { id: draftId },
      data: { status: "SENT" }
    });
  }

  await prisma.jobLog.create({
    data: {
      jobName: "newsletter-send",
      status: failed > 0 ? "WARNING" : "SUCCESS",
      message: `${draft.subject}: ${sent} məktub göndərildi, ${failed} xəta, ${remaining} növbədə qaldı.`
    }
  });
  revalidatePath("/admin");
}

export async function rejectNewsletterDraftAction(formData: FormData) {
  const draftId = formData.get("draftId");
  if (typeof draftId !== "string" || !draftId) throw new Error("Bülleten seçilməyib.");

  const result = await prisma.newsletterDraft.updateMany({
    where: { id: draftId, status: "PENDING_REVIEW" },
    data: { status: "REJECTED", reviewedAt: new Date() }
  });
  if (result.count !== 1) throw new Error("Bülleten tapılmadı və ya artıq nəzərdən keçirilib.");
  revalidatePath("/admin");
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_SITE_URL sazlanmayıb.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Canlı sayt ünvanı HTTPS olmalıdır.");
  }
  return url.origin;
}
