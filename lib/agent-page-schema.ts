import { z } from "zod";

export const currencyPageDataSchema = z.object({
  kind: z.literal("AZN_TRY"),
  rateAzN: z.number().positive(),
  sourceUrl: z.string().url(),
  fetchedAt: z.string().datetime()
});

export const agentPagePayloadSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(90),
  title: z.string().trim().min(12).max(140),
  description: z.string().trim().min(60).max(220),
  content: z.string().trim().min(600).max(12_000),
  sourceUrl: z.string().url(),
  riskLevel: z.enum(["low", "high"]),
  confidence: z.number().min(0).max(1),
  factCheckPassed: z.boolean(),
  structuredData: currencyPageDataSchema.nullable()
});
