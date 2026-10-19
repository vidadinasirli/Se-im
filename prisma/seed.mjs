import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const groupSlug = "riyaziyyat-9-cu-sinif-cebr";
const questions = [
  {
    id: "seed-algebra-01",
    topic: "Xətti tənliklər",
    difficulty: "ASAN",
    prompt: "2x + 3 = 11 tənliyində x-in qiymətini tapın.",
    options: ["3", "4", "5", "7"],
    correctIndex: 1,
    explanation: "Əvvəlcə hər iki tərəfdən 3 çıxırıq: 2x = 8. Sonra 2-yə bölürük: x = 4."
  },
  {
    id: "seed-algebra-02",
    topic: "Xətti tənliklər",
    difficulty: "ASAN",
    prompt: "5x − 7 = 18 tənliyinin kökü hansıdır?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
    explanation: "Hər iki tərəfə 7 əlavə edirik: 5x = 25. Hər iki tərəfi 5-ə böləndə x = 5 alınır."
  },
  {
    id: "seed-algebra-03",
    topic: "Mötərizəli ifadələr",
    difficulty: "ORTA",
    prompt: "3(x − 2) = 12 tənliyinin kökünü tapın.",
    options: ["4", "5", "6", "8"],
    correctIndex: 2,
    explanation: "Hər iki tərəfi 3-ə bölürük: x − 2 = 4. Hər iki tərəfə 2 əlavə etdikdə x = 6 alınır."
  },
  {
    id: "seed-algebra-04",
    topic: "Qısa vurma düsturları",
    difficulty: "ORTA",
    prompt: "(a + b)² ifadəsinin düzgün açılışı hansıdır?",
    options: ["a² + b²", "a² + 2ab + b²", "a² − 2ab + b²", "2a + 2b"],
    correctIndex: 1,
    explanation: "(a + b)(a + b) hasilində a², iki ab həddi və b² alınır. Buna görə açılış a² + 2ab + b²-dir."
  },
  {
    id: "seed-algebra-05",
    topic: "Vuruqlara ayırma",
    difficulty: "ORTA",
    prompt: "x² − 9 ifadəsini vuruqlara ayırın.",
    options: [
      "(x − 9)(x + 1)",
      "(x − 3)²",
      "(x − 3)(x + 3)",
      "x(x − 9)"
    ],
    correctIndex: 2,
    explanation: "x² − 9 iki kvadratın fərqidir: x² − 3² = (x − 3)(x + 3)."
  }
];

try {
  for (const question of questions) {
    await prisma.question.upsert({
      where: { id: question.id },
      create: {
        ...question,
        groupSlug,
        subject: "Riyaziyyat",
        grade: 9,
        status: "APPROVED"
      },
      update: { ...question, status: "APPROVED" }
    });
  }
  console.log(`${questions.length} yoxlanılmış Riyaziyyat sualı hazırdır.`);
} finally {
  await prisma.$disconnect();
}
