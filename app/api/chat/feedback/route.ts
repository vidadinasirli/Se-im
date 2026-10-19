import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  chatId: z.string().min(1).max(40),
  feedback: z.enum(["UP", "DOWN"])
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Rəy məlumatı düzgün deyil." }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Rəy məlumatı düzgün deyil." }, { status: 400 });
  }

  const result = await prisma.chatLog.updateMany({
    where: { id: parsed.data.chatId, feedback: null },
    data: { feedback: parsed.data.feedback }
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Bu cavaba rəy əlavə etmək mümkün olmadı." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
