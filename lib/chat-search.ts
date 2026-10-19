import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChatSource = { title: string; body: string; url: string };
type SearchDocument = ChatSource & { id: string; contentHash: string };

// Yalnız öz saytımızın dərc olunmuş məzmununu FTS5 indeksində saxlayır.
export async function searchSiteContent(question: string): Promise<ChatSource[]> {
  await prisma.$executeRawUnsafe(
    "CREATE VIRTUAL TABLE IF NOT EXISTS ChatKnowledgeFts USING fts5(id UNINDEXED, title, body, url UNINDEXED, tokenize='unicode61 remove_diacritics 2')"
  );

  const documents = await collectDocuments();
  await syncIndex(documents);

  const tokens = question
    .toLocaleLowerCase("az")
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.filter((token) => !STOP_WORDS.has(token))
    .slice(0, 12);
  if (!tokens?.length) return [];

  const matchExpression = [...new Set(tokens)]
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" OR ");
  const matches = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
    SELECT id, bm25(ChatKnowledgeFts, 4.0, 1.0) AS score
    FROM ChatKnowledgeFts
    WHERE ChatKnowledgeFts MATCH ${matchExpression}
    ORDER BY score
    LIMIT 5
  `;

  if (matches.length === 0) return [];
  const byId = new Map(documents.map((document) => [document.id, document]));
  return matches
    .map((match) => byId.get(match.id))
    .filter((document): document is SearchDocument => document !== undefined)
    .map(({ title, body, url }) => ({ title, body, url }));
}

async function collectDocuments(): Promise<SearchDocument[]> {
  const [contentItems, questions, events, agentPages] = await Promise.all([
    prisma.contentItem.findMany(),
    prisma.question.findMany({ where: { status: "APPROVED" } }),
    prisma.examEvent.findMany(),
    prisma.agentPage.findMany({ where: { noindex: false } })
  ]);

  const documents: SearchDocument[] = [];
  for (const item of contentItems) {
    const body = jsonText(item.value).slice(0, 8_000);
    const title = item.key.replace(/[:_-]+/g, " ");
    documents.push(createDocument(`content:${item.id}`, title, body, contentItemUrl(item.key, item.value)));
  }

  for (const question of questions) {
    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [];
    const body = [
      `Fənn: ${question.subject}`,
      `Sinif: ${question.grade}`,
      `Mövzu: ${question.topic}`,
      `Çətinlik: ${question.difficulty}`,
      `Sual: ${question.prompt}`,
      `Cavab variantları: ${options.join("; ")}`,
      `Düzgün cavab: ${options[question.correctIndex] ?? ""}`,
      `İzah: ${question.explanation}`
    ].join("\n");
    documents.push(
      createDocument(
        `question:${question.id}`,
        `${question.subject} — ${question.topic}`,
        body,
        `/testler/${encodeURIComponent(question.groupSlug)}`
      )
    );
  }

  for (const event of events) {
    const body = [
      `Tədbir: ${event.title}`,
      `Növ: ${event.type}`,
      `İmtahan tarixi: ${event.eventDate?.toISOString() ?? "göstərilməyib"}`,
      `Son qeydiyyat tarixi: ${event.applicationDeadline?.toISOString() ?? "göstərilməyib"}`,
      `Təsvir: ${event.description ?? ""}`
    ].join("\n");
    documents.push(createDocument(`event:${event.id}`, event.title, body, "/imtahan-teqvimi"));
  }
  for (const page of agentPages) {
    const path = page.slug === "azn-try-cevirici"
      ? `/valyuta/${page.slug}`
      : `/guide/${page.slug}`;
    const body = [
      page.description,
      page.content,
      `Mənbə: ${page.sourceUrl}`,
      `Son yeniləmə: ${page.updatedAt.toISOString()}`,
      jsonText(page.structuredData)
    ].filter(Boolean).join("\n");
    documents.push(createDocument(`agent-page:${page.slug}`, page.title, body, path));
  }
  return documents;
}

async function syncIndex(documents: SearchDocument[]) {
  const liveIds = documents.map((document) => document.id);

  await prisma.$transaction(async (transaction) => {
    const indexed = await transaction.chatSearchDocument.findMany({
      select: { id: true, contentHash: true }
    });
    const knownHashes = new Map(indexed.map((document) => [document.id, document.contentHash]));

    for (const document of documents) {
      if (knownHashes.get(document.id) === document.contentHash) continue;
      await transaction.chatSearchDocument.upsert({
        where: { id: document.id },
        create: document,
        update: document
      });
      await transaction.$executeRaw`DELETE FROM ChatKnowledgeFts WHERE id = ${document.id}`;
      await transaction.$executeRaw`
        INSERT INTO ChatKnowledgeFts (id, title, body, url)
        VALUES (${document.id}, ${document.title}, ${document.body}, ${document.url})
      `;
    }

    const staleIds = indexed
      .filter((document) => !liveIds.includes(document.id))
      .map((document) => document.id);
    if (staleIds.length > 0) {
      await transaction.chatSearchDocument.deleteMany({ where: { id: { in: staleIds } } });
      for (const id of staleIds) {
        await transaction.$executeRaw`DELETE FROM ChatKnowledgeFts WHERE id = ${id}`;
      }
    }
  });
}

function createDocument(id: string, title: string, body: string, url: string): SearchDocument {
  const contentHash = createHash("sha256")
    .update(`${title}\n${body}\n${url}`)
    .digest("hex");
  return { id, title, body, url, contentHash };
}

function contentItemUrl(key: string, value: Prisma.JsonValue) {
  if (key.startsWith("dim-event:")) return "/imtahan-teqvimi";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const path = value.path;
    if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
      const internalUrl = new URL(path, "https://site-content.invalid");
      if (internalUrl.origin === "https://site-content.invalid") {
        return `${internalUrl.pathname}${internalUrl.search}${internalUrl.hash}`;
      }
    }
  }
  return "/";
}

function jsonText(value: Prisma.JsonValue): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

const STOP_WORDS = new Set([
  "barədə",
  "bir",
  "bu",
  "da",
  "də",
  "de",
  "haqqında",
  "ilə",
  "üçün",
  "mən",
  "mənə",
  "sən",
  "tamamilə",
  "necə",
  "nə",
  "məlumat",
  "mövzu",
  "var",
  "və",
  "ya",
  "ki",
  "ver",
  "mi",
  "mı",
  "mu",
  "mü"
]);
