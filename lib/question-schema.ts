import { z } from "zod";

export const questionDraftSchema = z.object({
  groupSlug: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(80),
  grade: z.number().int().min(1).max(12),
  topic: z.string().trim().min(1).max(120),
  difficulty: z.enum(["ASAN", "ORTA", "ÇƏTİN"]),
  prompt: z.string().trim().min(10).max(1200),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(10).max(1200)
});

export const generatedQuestionsSchema = z.object({
  items: z.array(questionDraftSchema).min(1).max(5)
});

export const questionGroups = {
  "riyaziyyat-9-cu-sinif-cebr": {
    subject: "Riyaziyyat",
    grade: 9,
    topic: "Cəbr",
    title: "9-cu sinif Riyaziyyat — Cəbr"
  }
} as const;

export type QuestionGroupSlug = keyof typeof questionGroups;
