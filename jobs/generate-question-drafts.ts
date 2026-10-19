import { generateStructuredData } from "@/lib/ai";
import { generatedQuestionsSchema } from "@/lib/question-schema";
import { prisma } from "@/lib/prisma";

// AI suallarını yalnız qaralama kimi saxlayır; avtomatik nəşr edilmir.
export async function generateQuestionDrafts() {
  const groupSlug = "riyaziyyat-9-cu-sinif-cebr";
  const generated = await generateStructuredData(
    "Azərbaycan dilində 9-cu sinif Riyaziyyat fənninin Cəbr mövzusu üzrə 5 müxtəlif, " +
      "çoxseçimli test sualı yarat. Hər sualın düz 4 cavab variantı, bir düzgün cavab indeksi " +
      "(0-dan başlayır) və həll addımlarını izah edən cavabı olsun. " +
      "JSON quruluşu: {\"items\":[{\"groupSlug\":\"riyaziyyat-9-cu-sinif-cebr\"," +
      "\"subject\":\"Riyaziyyat\",\"grade\":9,\"topic\":\"Cəbr\"," +
      "\"difficulty\":\"ASAN|ORTA|ÇƏTİN\",\"prompt\":\"...\",\"options\":[\"...\"]," +
      "\"correctIndex\":0,\"explanation\":\"...\"}]}",
    generatedQuestionsSchema
  );

  if (
    generated.items.some(
      (question) =>
        question.groupSlug !== groupSlug ||
        question.subject !== "Riyaziyyat" ||
        question.grade !== 9
    )
  ) {
    throw new Error("AI gözlənilən fənn və sinif üçün sual qaytarmadı.");
  }

  const results = [];
  for (const question of generated.items) {
    const created = await prisma.question.create({
      data: {
        ...question,
        options: question.options,
        status: "DRAFT"
      }
    });
    results.push(created.id);
  }

  return results;
}
