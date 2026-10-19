import { Prisma } from "@prisma/client";
import { z } from "zod";
import { extractStructuredData } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { stableJson, toInputJsonValue } from "@/lib/prisma-json";

const dimCalendarSchema = z.object({
  events: z.array(
    z.object({
      title: z.string().trim().min(3).max(240),
      type: z.enum(["BURAXILIS", "BLOK", "QEBUL", "OTHER"]),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      description: z.string().max(1000).nullable(),
      confidence: z.number().min(0).max(1)
    })
  )
});

// Rəsmi DİM elanlarını oxuyur və bütün təqvim yeniliklərini təsdiq üçün növbəyə qoyur.
export async function runDimCalendarJob() {
  const sourceUrl = process.env.DIM_EXAM_SOURCE_URL;
  if (!sourceUrl) throw new Error("DIM_EXAM_SOURCE_URL mühit dəyişəni təyin edilməyib.");

  const parsedUrl = new URL(sourceUrl);
  if (!isOfficialDimUrl(parsedUrl)) {
    throw new Error("DİM mənbə ünvanı dim.gov.az domenində olmalıdır.");
  }

  const source = await fetchDimSource(sourceUrl);
  const extracted = await extractStructuredData(
    `Mənbə URL-i: ${sourceUrl}\nRəsmi səhifənin mətni:\n${source}\n\n` +
      "Yalnız DİM-in imtahan və qəbul təqviminə aid tarixləri çıxar. " +
      "Yaddaşında olan tarixləri və bu günə dair fərziyyələri əlavə etmə. " +
      "Tarix mənbədə yoxdursa null qaytar. Tədbir növünü BURAXILIS, BLOK, QEBUL və ya OTHER seç. " +
      "JSON: {\"events\":[{\"title\":\"...\",\"type\":\"BURAXILIS|BLOK|QEBUL|OTHER\"," +
      "\"eventDate\":\"YYYY-MM-DD və ya null\",\"applicationDeadline\":\"YYYY-MM-DD və ya null\"," +
      "\"description\":\"... və ya null\",\"confidence\":0.0}]}\n\n" +
      source,
    dimCalendarSchema
  );

  let pending = 0;
  let unchanged = 0;
  let withoutDate = 0;

  for (const event of extracted.events) {
    if (!event.eventDate && !event.applicationDeadline) {
      withoutDate += 1;
      continue;
    }

    const eventDate = event.eventDate ? parseDate(event.eventDate) : null;
    const applicationDeadline = event.applicationDeadline
      ? parseDate(event.applicationDeadline)
      : null;
    const eventId = `dim-${event.type.toLocaleLowerCase("en")}-${slugify(event.title)}`;
    const eventValue = {
      id: eventId,
      title: event.title,
      type: event.type,
      eventDate: eventDate?.toISOString() ?? null,
      applicationDeadline: applicationDeadline?.toISOString() ?? null,
      description: event.description,
      sourceUrl,
      confidence: event.confidence
    };
    const contentKey = `dim-event:${eventId}`;
    const existing = await prisma.contentItem.findUnique({ where: { key: contentKey } });

    if (existing && stableJson(existing.value) === stableJson(eventValue)) {
      await prisma.pendingChange.updateMany({
        where: { contentKey, status: "PENDING" },
        data: { status: "REJECTED", reviewedAt: new Date() }
      });
      unchanged += 1;
      continue;
    }

    const currentPending = await prisma.pendingChange.findMany({
      where: { contentKey, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, newValue: true }
    });
    const samePending = currentPending.find(
      (change) => stableJson(change.newValue) === stableJson(eventValue)
    );
    if (samePending) {
      const duplicateIds = currentPending
        .filter((change) => change.id !== samePending.id)
        .map((change) => change.id);
      if (duplicateIds.length > 0) {
        await prisma.pendingChange.updateMany({
          where: { id: { in: duplicateIds } },
          data: { status: "REJECTED", reviewedAt: new Date() }
        });
      }
      unchanged += 1;
      continue;
    }

    const pendingData = {
      oldValue: existing ? toInputJsonValue(existing.value) : Prisma.JsonNull,
      newValue: toInputJsonValue(eventValue),
      sourceUrl,
      confidence: event.confidence,
      riskLevel: "HIGH" as const,
      createdAt: new Date()
    };
    const pendingForEvent = currentPending[0];

    if (pendingForEvent) {
      await prisma.pendingChange.update({
        where: { id: pendingForEvent.id },
        data: pendingData
      });
      const duplicateIds = currentPending
        .slice(1)
        .map((change) => change.id);
      if (duplicateIds.length > 0) {
        await prisma.pendingChange.updateMany({
          where: { id: { in: duplicateIds } },
          data: { status: "REJECTED", reviewedAt: new Date() }
        });
      }
    } else {
      await prisma.pendingChange.create({ data: { contentKey, ...pendingData } });
    }
    pending += 1;
  }

  return { found: extracted.events.length, pending, unchanged, withoutDate };
}

async function fetchDimSource(sourceUrl: string) {
  let currentUrl = new URL(sourceUrl);
  let response: Response | undefined;
  const signal = AbortSignal.timeout(25_000);

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    response = await fetch(currentUrl, {
      headers: { "User-Agent": "AbituriyentHazirliqBot/1.0" },
      signal,
      cache: "no-store",
      redirect: "manual"
    });

    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirects === 5) {
      throw new Error("DİM mənbə səhifəsinin yönləndirməsi etibarlı deyil.");
    }
    currentUrl = new URL(location, currentUrl);
    if (!isOfficialDimUrl(currentUrl)) {
      throw new Error("DİM mənbə səhifəsi rəsmi domen xaricinə yönləndirildi.");
    }
  }

  if (!response?.ok) {
    throw new Error(`DİM mənbə səhifəsi oxunmadı (${response?.status ?? "naməlum xəta"}).`);
  }

  const html = await response.text();
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .slice(0, 30_000);
}

function isOfficialDimUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    (url.port === "" || url.port === "443") &&
    !url.username &&
    !url.password &&
    (url.hostname === "dim.gov.az" || url.hostname.endsWith(".dim.gov.az"))
  );
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`AI etibarsız tarix qaytardı: ${value}`);
  }
  return date;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
