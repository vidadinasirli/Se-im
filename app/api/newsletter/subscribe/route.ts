import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeNewsletterRateLimit, createNewsletterToken, hashNewsletterToken } from "@/lib/newsletter";
import { sendNewsletterEmail } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/chat-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_LIMIT = 4_096;
const schema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  website: z.string().max(0).optional()
});

export async function POST(request: Request) {
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Sorğu ölçüsü icazə verilən həddi aşır." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Sorğu formatı düzgün deyil." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Düzgün e-poçt ünvanı yazın və razılıq xanasını işarələyin." },
      { status: 400 }
    );
  }
  if (!process.env.RESEND_API_KEY || !process.env.NEWSLETTER_FROM) {
    return NextResponse.json(
      { error: "Abunəlik xidməti hələ sazlanmayıb. Bir qədər sonra yenidən yoxlayın." },
      { status: 503 }
    );
  }

  try {
    const rateLimit = await consumeNewsletterRateLimit(getClientIp(request));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Çoxsaylı sorğu göndərildi. Bir dəqiqə sonra yenidən yoxlayın." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const email = parsed.data.email.toLocaleLowerCase("en-US");
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing?.status === "CONFIRMED") {
      return NextResponse.json({
        message: "Sorğu qəbul edildi. Abunəliyi yoxlamaq üçün e-poçtunu yoxla."
      });
    }

    const token = createNewsletterToken();
    const unsubscribeToken = existing?.unsubscribeToken ?? createNewsletterToken();
    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        consentAt: new Date(),
        confirmationTokenHash: hashNewsletterToken(token),
        unsubscribeToken
      },
      update: {
        consentAt: new Date(),
        confirmationTokenHash: hashNewsletterToken(token),
        unsubscribeToken
      }
    });
    const baseUrl = getSiteUrl();
    try {
      await sendNewsletterEmail({
        to: email,
        subject: "Bülleten abunəliyini təsdiqlə",
        preview: "Həftəlik hazırlıq planını almaq üçün e-poçt ünvanını təsdiqlə.",
        content:
          "Abunəliyi tamamlamaq üçün aşağıdakı təsdiq keçidini aç. Əgər bu sorğunu sən göndərməmisənsə, bu məktubu nəzərə alma.",
        actionUrl: `${baseUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`,
        actionLabel: "Abunəliyi təsdiqlə",
        idempotencyKey: `newsletter-confirm-${subscriber.id}-${hashNewsletterToken(token).slice(0, 16)}`
      });
    } catch (error) {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { confirmationTokenHash: null }
      });
      throw error;
    }

    return NextResponse.json({
      message: "Təsdiq keçidi göndərildi. Abunəliyi tamamlamaq üçün e-poçtunu yoxla."
    });
  } catch (error) {
    console.error("Bülleten abunəliyi qeydə alınmadı:", error);
    return NextResponse.json(
      { error: "Abunəlik sorğusu tamamlanmadı. Bir az sonra yenidən cəhd edin." },
      { status: 503 }
    );
  }
}

export async function PUT(request: Request) {
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Sorğu ölçüsü icazə verilən həddi aşır." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Sorğu formatı düzgün deyil." }, { status: 400 });
  }
  const parsed = z.object({ token: z.string().min(32).max(100) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Təsdiq keçidi düzgün deyil." }, { status: 400 });
  }

  try {
    const subscriber = await prisma.newsletterSubscriber.findFirst({
      where: { confirmationTokenHash: hashNewsletterToken(parsed.data.token), status: "PENDING" }
    });
    if (!subscriber) {
      return NextResponse.json(
        { error: "Təsdiq keçidi etibarsızdır və ya artıq istifadə olunub." },
        { status: 400 }
      );
    }
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmationTokenHash: null
      }
    });
    return NextResponse.json({ message: "Abunəliyin təsdiqləndi. Təşəkkür edirik!" });
  } catch (error) {
    console.error("Bülleten abunəliyi təsdiqlənmədi:", error);
    return NextResponse.json({ error: "Təsdiq zamanı xəta baş verdi." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Sorğu ölçüsü icazə verilən həddi aşır." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Sorğu formatı düzgün deyil." }, { status: 400 });
  }
  const parsed = z.object({ token: z.string().min(32).max(100) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Abunəlikdən çıxış keçidi düzgün deyil." }, { status: 400 });
  }

  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: parsed.data.token },
      select: { id: true }
    });
    if (subscriber) {
      await prisma.newsletterSubscriber.delete({ where: { id: subscriber.id } });
    }
    return NextResponse.json({ message: "Abunəlik ləğv edildi." });
  } catch (error) {
    console.error("Bülleten abunəliyi ləğv edilmədi:", error);
    return NextResponse.json({ error: "Abunəlik ləğv edilərkən xəta baş verdi." }, { status: 503 });
  }
}

async function readLimitedBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > BODY_LIMIT) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_LIMIT) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
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
