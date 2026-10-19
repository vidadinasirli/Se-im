import { Prisma } from "@prisma/client";
import { z } from "zod";
import { extractStructuredData } from "@/lib/ai";
import { stableJson, toInputJsonValue } from "@/lib/prisma-json";
import { prisma } from "@/lib/prisma";

const jsonValueSchema: z.ZodType<Prisma.JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const extractedContentSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().trim().min(1).max(160),
      value: jsonValueSchema,
      riskLevel: z.enum(["low", "high"]),
      confidence: z.number().min(0).max(1)
    })
  )
});

type ExtractedItem = z.infer<typeof extractedContentSchema>["items"][number];

// Konfiqurasiya edilmiş mənbələri oxuyur, dəyişiklikləri yoxlayır və riskə uyğun emal edir.
export async function runRefreshContentJob() {
  const sourceUrls = (process.env.CONTENT_SOURCE_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (sourceUrls.length === 0) {
    throw new Error("CONTENT_SOURCE_URLS mühit dəyişənində mənbə göstərilməyib.");
  }

  let published = 0;
  let pending = 0;

  for (const sourceUrl of sourceUrls) {
    const source = await fetchSource(sourceUrl);
    const extraction = await extractStructuredData(source, extractedContentSchema);

    for (const item of extraction.items) {
      const existing = await prisma.contentItem.findUnique({ where: { key: item.key } });
      if (existing && stableJson(existing.value) === stableJson(item.value)) continue;

      const riskLevel = requiresReview(item) ? "HIGH" : "LOW";
      if (riskLevel === "HIGH") {
        const unresolvedChanges = await prisma.pendingChange.findMany({
          where: { contentKey: item.key, status: "PENDING" },
          select: { newValue: true }
        });
        if (unresolvedChanges.some((change) => stableJson(change.newValue) === stableJson(item.value))) {
          continue;
        }
      }

      const oldValue = existing ? toInputJsonValue(existing.value) : Prisma.JsonNull;
      const newValue = toInputJsonValue(item.value);

      if (riskLevel === "LOW") {
        await prisma.$transaction([
          prisma.contentItem.upsert({
            where: { key: item.key },
            create: {
              key: item.key,
              value: newValue,
              sourceUrl,
              confidence: item.confidence
            },
            update: { value: newValue, sourceUrl, confidence: item.confidence }
          }),
          prisma.changeLog.create({
            data: {
              contentKey: item.key,
              action: "AUTO_PUBLISHED",
              oldValue,
              newValue,
              sourceUrl,
              confidence: item.confidence
            }
          })
        ]);
        published += 1;
      } else {
        await prisma.pendingChange.create({
          data: {
            contentKey: item.key,
            oldValue,
            newValue,
            sourceUrl,
            confidence: item.confidence,
            riskLevel
          }
        });
        pending += 1;
      }
    }
  }

  return { published, pending };
}

async function fetchSource(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "AzContentPlatformBot/1.0" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Mənbə oxunmadı (${response.status}): ${sourceUrl}`);
  }

  const body = await response.text();
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .slice(0, 20_000);
}

function requiresReview(item: ExtractedItem) {
  if (item.riskLevel === "high") return true;
  const descriptor = `${item.key} ${stableJson(item.value)}`.toLocaleLowerCase("az");
  const highRiskTerms = [
    "vergi",
    "ədv",
    "cərimə",
    "cəza",
    "rüsum",
    "tarix",
    "son müddət",
    "ödəniş",
    "qiymət",
    "məbləğ",
    "faiz dərəcəsi",
    "maaş",
    "minimum əmək haqqı"
  ];
  return highRiskTerms.some((term) => descriptor.includes(term));
}
