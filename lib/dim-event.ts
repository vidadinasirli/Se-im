import { z } from "zod";

export const dimEventValueSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(3).max(240),
  type: z.enum(["BURAXILIS", "BLOK", "QEBUL", "OTHER"]),
  eventDate: z.string().datetime().nullable(),
  applicationDeadline: z.string().datetime().nullable(),
  description: z.string().max(1000).nullable(),
  sourceUrl: z.string().url(),
  confidence: z.number().min(0).max(1)
});

export function toExamEventRecord(event: z.infer<typeof dimEventValueSchema>) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    eventDate: event.eventDate ? new Date(event.eventDate) : null,
    applicationDeadline: event.applicationDeadline
      ? new Date(event.applicationDeadline)
      : null,
    description: event.description,
    sourceUrl: event.sourceUrl,
    confidence: event.confidence
  };
}
